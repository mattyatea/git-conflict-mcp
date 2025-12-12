export class State {
    private static instance: State;
    private projectPath: string | null = null;
    private rejections: Map<string, string> = new Map(); // filePath -> rejectionReason

    private constructor() { }

    static getInstance(): State {
        if (!State.instance) {
            State.instance = new State();
        }
        return State.instance;
    }

    setProjectPath(path: string) {
        this.projectPath = path;
    }

    getProjectPath(): string | null {
        return this.projectPath;
    }

    addRejection(filePath: string, reason: string) {
        this.rejections.set(filePath, reason);
    }

    getRejection(filePath: string): string | undefined {
        return this.rejections.get(filePath);
    }

    clearRejection(filePath: string) {
        this.rejections.delete(filePath);
    }
}

export const state = State.getInstance();
