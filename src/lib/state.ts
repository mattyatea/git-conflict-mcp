export class State {
    private static instance: State;
    private projectPath: string | null = null;

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
}

export const state = State.getInstance();
