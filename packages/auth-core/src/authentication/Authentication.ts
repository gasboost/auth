import { User } from "../domain/User";

export interface Authentication<T> {
  verify(credential: T): Promise<User>;
}
