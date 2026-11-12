import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function verifyPassword(password, hash) { return bcrypt.compareSync(password, hash); }
export function issueToken(user) {
  return jwt.sign({ sub: String(user.id), roles: user.roles, name: user.name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
export function authenticate(store) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Token inválido o vencido' });
    }
    try {
      const user = await store.findUserById(payload.sub);
      if (!user?.active) return res.status(401).json({ error: 'Usuario inactivo o inexistente' });
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
export function authorize(...allowedRoles) {
  return (req, res, next) => req.user.roles.some((role) => allowedRoles.includes(role))
    ? next() : res.status(403).json({ error: 'Permisos insuficientes' });
}
