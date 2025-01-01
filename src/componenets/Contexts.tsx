import { createContext } from "react";

export type User = {
  id: string;
  privateId: string;
  name: string;
};

export const UserContext = createContext<User | null>(null);
