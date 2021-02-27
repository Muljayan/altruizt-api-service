import jwt from 'jsonwebtoken';

const extractToken = (req) => {
  const token = req.headers['x-auth-token'];
  const decodedData = jwt.decode(token);
  return decodedData;
};

export default extractToken;
