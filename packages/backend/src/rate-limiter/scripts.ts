/**
 * Redis Lua Scripts for Atomic Rate Limiting Operations
 *
 * All operations use Lua scripts for atomicity — no race conditions,
 * no double-counts, no inconsistent state even under heavy concurrency.
 */

// ============================================================
// 1. FIXED WINDOW — Atomic counter with TTL
// ============================================================
export const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Get current count
local current = tonumber(redis.call('GET', key) or '0')

-- Check if allowed
if current < max_requests then
  -- Increment counter
  local new_count = redis.call('INCR', key)
  -- Set TTL on first request
  if new_count == 1 then
    redis.call('PEXPIRE', key, window_ms)
  end
  local remaining = max_requests - new_count
  local reset_at = now + window_ms
  return {1, remaining, max_requests, reset_at}
else
  -- Blocked
  local ttl = redis.call('PTTL', key)
  local reset_at = now + ttl
  return {0, 0, max_requests, reset_at}
end
`;

// ============================================================
// 2. SLIDING WINDOW COUNTER — Weighted interpolation
// ============================================================
export const SLIDING_WINDOW_SCRIPT = `
local current_key = KEYS[1]
local previous_key = KEYS[2]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Get counts from current and previous windows
local current_count = tonumber(redis.call('GET', current_key) or '0')
local previous_count = tonumber(redis.call('GET', previous_key) or '0')

-- Calculate position within current window (0.0 to 1.0)
local window_start = math.floor(now / window_ms) * window_ms
local elapsed = now - window_start
local weight = 1 - (elapsed / window_ms)

-- Weighted count
local weighted_count = math.floor(previous_count * weight + current_count)

-- Check if allowed
if weighted_count < max_requests then
  local new_count = redis.call('INCR', current_key)
  if new_count == 1 then
    redis.call('PEXPIRE', current_key, window_ms * 2)
  end
  local remaining = max_requests - (new_count + math.floor(previous_count * weight))
  if remaining < 0 then remaining = 0 end
  local reset_at = window_start + window_ms
  return {1, remaining, max_requests, reset_at}
else
  local ttl = redis.call('PTTL', current_key)
  local reset_at = window_start + window_ms
  return {0, 0, max_requests, reset_at}
end
`;

// ============================================================
// 3. SLIDING LOG — Sorted set of timestamps
// ============================================================
export const SLIDING_LOG_SCRIPT = `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local unique_id = ARGV[4]

-- Remove expired entries (outside the window)
local window_start = now - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < max_requests then
  -- Add new entry with unique member
  redis.call('ZADD', key, now, unique_id)
  -- Set TTL for cleanup
  redis.call('PEXPIRE', key, window_ms)
  local remaining = max_requests - count - 1
  local reset_at = now + window_ms
  return {1, remaining, max_requests, reset_at}
else
  -- Blocked — get oldest entry to calculate retry-after
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after = 0
  if #oldest >= 2 then
    retry_after = tonumber(oldest[2]) + window_ms - now
  end
  if retry_after < 0 then retry_after = 0 end
  local ttl = redis.call('PTTL', key)
  local reset_at = now + ttl
  return {0, 0, max_requests, reset_at, retry_after}
end
`;

// ============================================================
// 4. TOKEN BUCKET — Refill + consume
// ============================================================
export const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local window_ms = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local tokens_to_consume = tonumber(ARGV[5])

-- Get current state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- Initialize if new bucket
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- Calculate refill
local elapsed = now - last_refill
if elapsed > 0 then
  local refill = elapsed * (refill_rate / window_ms)
  tokens = math.min(capacity, tokens + refill)
  last_refill = now
end

-- Try to consume tokens
if tokens >= tokens_to_consume then
  tokens = tokens - tokens_to_consume
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
  redis.call('PEXPIRE', key, window_ms * 3)
  local remaining = math.floor(tokens)
  local reset_at = now + math.ceil((capacity - tokens) / (refill_rate / window_ms))
  return {1, remaining, capacity, reset_at}
else
  -- Not enough tokens — update last_refill but don't consume
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
  redis.call('PEXPIRE', key, window_ms * 3)
  local retry_after = math.ceil((tokens_to_consume - tokens) / (refill_rate / window_ms))
  local reset_at = now + retry_after
  return {0, math.floor(tokens), capacity, reset_at, retry_after}
end
`;

// ============================================================
// 5. LEAKY BUCKET — Queue with processing
// ============================================================
export const LEAKY_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leak_rate = tonumber(ARGV[2])
local window_ms = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Get bucket state
local state = redis.call('HMGET', key, 'queue_size', 'last_leak')
local queue_size = tonumber(state[1])
local last_leak = tonumber(state[2])

-- Initialize if new
if queue_size == nil then
  queue_size = 0
  last_leak = now
end

-- Process (leak) requests that have been processed
local elapsed = now - last_leak
if elapsed > 0 then
  local leaked = math.floor(elapsed * (leak_rate / window_ms))
  queue_size = math.max(0, queue_size - leaked)
  last_leak = now
end

if queue_size < capacity then
  -- Add request to queue
  queue_size = queue_size + 1
  redis.call('HMSET', key, 'queue_size', tostring(queue_size), 'last_leak', tostring(last_leak))
  redis.call('PEXPIRE', key, window_ms * 3)
  local remaining = capacity - queue_size
  local reset_at = now + window_ms
  return {1, remaining, capacity, reset_at}
else
  -- Queue full
  redis.call('HMSET', key, 'queue_size', tostring(queue_size), 'last_leak', tostring(last_leak))
  redis.call('PEXPIRE', key, window_ms * 3)
  local retry_after = math.ceil((queue_size - capacity + 1) / (leak_rate / window_ms))
  local reset_at = now + retry_after
  return {0, 0, capacity, reset_at, retry_after}
end
`;

// ============================================================
// 6. ANALYTICS — Increment counters atomically
// ============================================================
export const ANALYTICS_INCREMENT_SCRIPT = `
local total_key = KEYS[1]
local allowed_key = KEYS[2]
local blocked_key = KEYS[3]
local rps_key = KEYS[4]
local now = tonumber(ARGV[1])
local allowed = tonumber(ARGV[2])
local window_ms = tonumber(ARGV[3])

-- Increment totals
redis.call('INCR', total_key)
redis.call('PEXPIRE', total_key, window_ms * 2)

if allowed == 1 then
  redis.call('INCR', allowed_key)
  redis.call('PEXPIRE', allowed_key, window_ms * 2)
else
  redis.call('INCR', blocked_key)
  redis.call('PEXPIRE', blocked_key, window_ms * 2)
end

-- Track RPS in sorted set (1-second resolution)
local second = math.floor(now / 1000) * 1000
redis.call('ZADD', rps_key, second, tostring(second))
redis.call('PEXPIRE', rps_key, 120000)

-- Get current RPS
local minute_ago = now - 60000
redis.call('ZREMRANGEBYSCORE', rps_key, '-inf', minute_ago)
local rps_entries = redis.call('ZRANGE', rps_key, 0, -1, 'WITHSCORES')
local current_rps = 0
if #rps_entries > 0 then
  current_rps = math.floor(#rps_entries / 2)
end

return {redis.call('INCR', total_key) - 1, current_rps}
`;
