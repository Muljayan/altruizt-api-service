import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/secrets';

// Super admin : superadmin
// Super admin and organizations : moderator
// Organizations : organization
// All users : all

const validateToken = (res, token) => {
  try {
    if (!token) {
      throw new Error('No token available');
    }
    jwt.verify(token, JWT_SECRET);
    const decoded = jwt.decode(token);
    return decoded;
  } catch (err) {
    const errors = {
      message: 'Invalid token, authorization denied',
      type: 'INVALID_TOKEN',
    };
    res.status(401).send(errors);
    return null;
  }
};

// All registered users
export const all = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  const decodedToken = validateToken(res, token);
  if (token && decodedToken) {
    next();
  }
};

export const organization = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  const decodedToken = validateToken(res, token);

  try {
    if (decodedToken && !decodedToken.organization) {
      throw new Error('Not an organization');
    }
    if (token && decodedToken) {
      next();
    }
  } catch (err) {
    const errors = {
      message: 'Invalid token, authorization denied',
      type: 'INVALID_TOKEN',
    };
    return res.status(401).send(errors);
  }
  return null;
};

// Super admin and organizations
export const moderator = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  const decodedToken = validateToken(res, token);

  try {
    if (decodedToken && !(decodedToken.organization || decodedToken.isSuperAdmin)) {
      throw new Error('Not an organization or superadmin');
    }
    if (token && decodedToken) {
      next();
    }
  } catch (err) {
    const errors = {
      message: 'Invalid token, authorization denied',
      type: 'INVALID_TOKEN',
    };
    return res.status(401).send(errors);
  }
  return null;
};

// Super admin only
export const superadmin = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  const decodedToken = validateToken(res, token);
  try {
    if (decodedToken && (!decodedToken.isSuperAdmin)) {
      throw new Error('Not an organization or superadmin');
    }
    if (token && decodedToken) {
      next();
    }
  } catch (err) {
    const errors = {
      message: 'Invalid token, authorization denied',
      type: 'INVALID_TOKEN',
    };
    return res.status(401).send(errors);
  }
  return null;
};
