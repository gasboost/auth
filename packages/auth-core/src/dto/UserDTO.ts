import type { User } from "../domain/User";

/** Public user fields. Consumer-provided data must be safe to expose. */
export class UserDTO<TData = never> {
  readonly id: string;
  readonly name: string;
  declare readonly data: TData;

  constructor(user: User & { readonly data?: TData }) {
    this.id = user.id;
    this.name = user.name;
    if (Object.prototype.hasOwnProperty.call(user, "data")) {
      this.data = user.data as TData;
    }
  }
}
