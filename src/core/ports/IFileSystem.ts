/**
 * Represents a pure port abstraction for read and write operations on the file system.
 * 
 * This contract is designed following Hexagonal Architecture principles to decouple
 * the dependency analysis core from native Node.js dependencies (such as 'fs' or 'path') 
 * and specific environments (such as the VS Code API). Infrastructure adapters implement 
 * this port to provide actual persistence.
 */
export interface IFileSystem {
    /**
     * Determines whether a specific path exists in the file system.
     * @param path Absolute or relative path to verify.
     * @returns Promise with a boolean value indicating the existence of the resource.
     */
    pathExists(path: string): Promise<boolean>;

    /**
     * Reads and returns the content of a file in utf-8 text format.
     * @param path Path of the file to read.
     * @returns Promise with the file content as a string.
     */
    readFile(path: string): Promise<string>;

    /**
     * Lists the names of the files and directories contained in the specified path.
     * @param path Path of the directory to inspect.
     * @returns Promise with an array of file/directory names.
     */
    readDirectory(path: string): Promise<string[]>;

    /**
     * Joins multiple path segments into a single standardized path.
     * @param paths Path segments to concatenate.
     * @returns Combined and normalized path according to the execution environment.
     */
    joinPaths(...paths: string[]): string;

    /**
     * Returns the name of the containing directory of a specific path.
     * @param path Path to evaluate.
     * @returns Name of the parent directory.
     */
    getDirname(path: string): string;

    /**
     * Returns the final part of a path (file or directory name).
     * @param path Path to evaluate.
     * @returns Base name of the resource.
     */
    getBasename(path: string): string;

    /**
     * Determines if the provided path points to a directory.
     * @param path Verify path.
     * @returns Promise with a boolean value indicating if it is a directory.
     */
    isDirectory(path: string): Promise<boolean>;

    /**
     * Writes text content to the specified path.
     * Creates the file if it does not exist, or replaces its content if it already exists.
     * @param path Path of the file to write.
     * @param content Content to save.
     * @returns Promise that resolves when the write operation completes.
     */
    writeFile(path: string, content: string): Promise<void>;
}


