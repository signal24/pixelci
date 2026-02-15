import { getGitLabCiInfo } from './ci-gitlab.js';

export interface ICIJobInfo {
    projectUrl: string;
    ciToken: string;
}

export function getJobInfo(): ICIJobInfo | null {
    const gitlabInfo = getGitLabCiInfo();
    if (gitlabInfo) {
        return gitlabInfo;
    }

    // todo: add GitHub

    return null;
}
