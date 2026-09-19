declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(filename: string);
    exec(sql: string): void;
    prepare(sql: string): { run(...params: any[]): void; get(...params: any[]): any; all(...params: any[]): any[] };
    close(): void;
  }
}
