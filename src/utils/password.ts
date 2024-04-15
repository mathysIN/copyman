import { createHash } from "crypto";

const SALT = process.env.SALT;

// const generateSalt = (length: number = 16): string => {
//   return randomBytes(Math.ceil(length / 2))
//     .toString("hex")
//     .slice(0, length);
// };

export const hashPassword = (password: string): string => {
  const hash = createHash("sha512");
  hash.update(password + SALT);
  return hash.digest("hex");
};

export const validatePassword = (
  password: string,
  hashedPassword: string,
): boolean => {
  const hash = password;
  return `${hash}` === `${hashedPassword}`;
};
