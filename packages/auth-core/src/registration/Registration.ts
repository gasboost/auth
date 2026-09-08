import { User } from "../domain/User";

export interface Registration<T> {
  register(input: T): Promise<User>;
}
