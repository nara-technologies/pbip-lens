import { EventEmitter } from "events";

/**
 * Interface representing a modern user model.
 * Used to demonstrate syntax highlighting for interfaces and properties.
 */
export interface User {
  readonly id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  isActive: boolean;
  createdAt: Date;
}

// A custom decorator to show how decorators are highlighted in Ainara
function LogMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`[LOG] Calling ${propertyKey} with args:`, args);
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Service class handling user business logic.
 * Demonstrates classes, inheritance, private members, async methods, and template strings.
 */
export class UserService extends EventEmitter {
  private users: Map<string, User> = new Map();

  constructor(private readonly apiEndpoint: string) {
    super();
    this.initializeDefaultUsers();
  }

  @LogMethod
  public async getUserById(id: string): Promise<User | null> {
    // Simulating database latency
    await new Promise((resolve) => setTimeout(resolve, 350));

    const user = this.users.get(id);
    if (!user) {
      console.warn(`User with ID "${id}" was not found.`);
      return null;
    }

    this.emit("userFetched", user);
    return { ...user };
  }

  @LogMethod
  public async createUser(name: string, email: string): Promise<User> {
    const newUser: User = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      email,
      role: "user",
      isActive: true,
      createdAt: new Date()
    };

    this.users.set(newUser.id, newUser);
    this.emit("userCreated", newUser);
    return newUser;
  }

  private initializeDefaultUsers(): void {
    const defaultUser: User = {
      id: "usr_999",
      name: "Ainara Developer",
      email: "developer@ainara.theme",
      role: "admin",
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(defaultUser.id, defaultUser);
  }
}
