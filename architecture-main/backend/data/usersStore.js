// Users store — predefined seed users (no registration required)
import { v4 as uuidv4 } from 'uuid';

const users = [
  {
    id: uuidv4(),
    fullName: 'אדמין ראשי',
    username: 'admin',
    password: 'admin123'
  },
  {
    id: uuidv4(),
    fullName: 'דנה כהן',
    username: 'dana',
    password: 'dana123'
  },
  {
    id: uuidv4(),
    fullName: 'יואב לוי',
    username: 'yoav',
    password: 'yoav123'
  },
  {
    id: uuidv4(),
    fullName: 'מיכל אברהם',
    username: 'michal',
    password: 'michal123'
  },
  {
    id: uuidv4(),
    fullName: 'רן שמאי',
    username: 'appraiser1',
    password: 'appraiser123'
  },
  {
    id: uuidv4(),
    fullName: 'נועה רשות',
    username: 'authority1',
    password: 'authority123'
  }
];

export function findUserByCredentials(username, password) {
  return users.find(u => u.username === username && u.password === password) || null;
}

export function findUserById(id) {
  return users.find(u => u.id === id) || null;
}

export function getAllUsers() {
  return users.map(({ password, ...u }) => u); // never expose passwords
}
