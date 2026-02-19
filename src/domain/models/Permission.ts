export interface PermissionJSON {
    id: string
    name: string
    description?: string
    resource: string
    action: string
    authority?: string
}

export class Permission {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string,
        public readonly resource: string,
        public readonly action: string
    ) {}

    get authority(): string {
        return `${this.resource}:${this.action}`
    }

    toJSON(): PermissionJSON {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            resource: this.resource,
            action: this.action,
            authority: this.authority,
        }
    }

    static fromJSON(data: PermissionJSON): Permission {
        return new Permission(
            data.id,
            data.name,
            data.description ?? '',
            data.resource ?? '',
            data.action ?? ''
        )
    }
}
