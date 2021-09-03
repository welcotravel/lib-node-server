export declare type APIDefinitionDownloaderConfig = {
    api_uri: string;
    service_id: string;
    service_secret: string;
};
export declare type APIDefinitionDownloaderPaths = {
    [path: string]: string;
};
export default class APIDefinitionDownloader {
    static download(oConfig: APIDefinitionDownloaderConfig, sDefinitionPath: string, oPaths: APIDefinitionDownloaderPaths): Promise<void>;
}
