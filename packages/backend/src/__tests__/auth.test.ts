describe('Auth Validation Schemas', () => {
  const { registerSchema, loginSchema, changePasswordSchema } = require('../auth/validation');

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'Password1',
        name: 'John',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak password (no uppercase)', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'password1',
        name: 'John',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'Ab1',
        name: 'John',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short name', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
        name: 'A',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1',
      });
      expect(result.success).toBe(true);
    });

    it('should reject weak new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPass1',
        newPassword: 'weak',
      });
      expect(result.success).toBe(false);
    });
  });
});
