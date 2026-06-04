"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const events_1 = require("events");
// A custom decorator to show how decorators are highlighted in Ainara
function LogMethod(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        console.log(`[LOG] Calling ${propertyKey} with args:`, args);
        return originalMethod.apply(this, args);
    };
    return descriptor;
}
/**
 * Service class handling user business logic.
 * Demonstrates classes, inheritance, private members, async methods, and template strings.
 */
let UserService = (() => {
    let _classSuper = events_1.EventEmitter;
    let _instanceExtraInitializers = [];
    let _getUserById_decorators;
    let _createUser_decorators;
    return class UserService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getUserById_decorators = [LogMethod];
            _createUser_decorators = [LogMethod];
            __esDecorate(this, null, _getUserById_decorators, { kind: "method", name: "getUserById", static: false, private: false, access: { has: obj => "getUserById" in obj, get: obj => obj.getUserById }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createUser_decorators, { kind: "method", name: "createUser", static: false, private: false, access: { has: obj => "createUser" in obj, get: obj => obj.createUser }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        apiEndpoint = __runInitializers(this, _instanceExtraInitializers);
        users = new Map();
        constructor(apiEndpoint) {
            super();
            this.apiEndpoint = apiEndpoint;
            this.initializeDefaultUsers();
        }
        async getUserById(id) {
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
        async createUser(name, email) {
            const newUser = {
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
        initializeDefaultUsers() {
            const defaultUser = {
                id: "usr_999",
                name: "Ainara Developer",
                email: "developer@ainara.theme",
                role: "admin",
                isActive: true,
                createdAt: new Date()
            };
            this.users.set(defaultUser.id, defaultUser);
        }
    };
})();
exports.UserService = UserService;
//# sourceMappingURL=sample.js.map