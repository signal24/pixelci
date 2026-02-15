<template>
    <div id="screens" class="full" :class="{ 'max-w-screen-xl mx-auto': !showChanges }">
        <LoaderModal v-if="isLoading" />

        <template v-else>
            <div class="header">
                <div class="flex gap-4 items-center">
                    <RouterLink :to="`/apps/${route.params.id}`">
                        <button class="back">
                            <i class="fa fa-arrow-left" />
                        </button>
                    </RouterLink>

                    <h1>Screens</h1>
                </div>

                <a
                    v-if="build && commitUrl"
                    class="commit-info"
                    :href="commitUrl"
                    target="_blank"
                    v-tooltip="build.commitSubject"
                >
                    <i class="fa fa-code-commit fa-sm" />
                    <span class="font-mono">{{ build.commitHash?.substring(0, 8) }}</span>
                    <span class="truncate">{{ build.commitSubject }}</span>
                </a>
                <div v-else-if="build" class="commit-info">
                    <i class="fa fa-code-commit fa-sm" />
                    <span class="font-mono">{{ build.commitHash?.substring(0, 8) }}</span>
                    <span class="truncate">{{ build.commitSubject }}</span>
                </div>

                <div class="flex gap-4 items-center">
                    <label v-if="showChanges">
                        <input type="checkbox" v-model="showDiff" data-testid="diff-check" />
                        Show Diff
                    </label>

                    <label>
                        <input type="checkbox" v-model="showChanges" data-testid="changes-check" />
                        Show Changes
                    </label>
                </div>
            </div>

            <div class="screen-list">
                <div v-for="screen in displayScreens" class="screen">
                    <div class="screen-meta">
                        <span class="screen-name">{{ screen.name }}</span>
                        <span
                            v-if="showChanges"
                            class="screen-status"
                            :class="getStatusStyle(screen.currentBuildScreen?.status)"
                            >{{
                                screen.currentBuildScreen ? getStatusText(screen.currentBuildScreen.status) : 'Removed'
                            }}</span
                        >
                    </div>

                    <div
                        v-if="
                            !showChanges ||
                            !screen.currentBuildScreen ||
                            !screen.referenceBuildScreen ||
                            screen.currentBuildScreen.status !== 'no changes'
                        "
                        class="image-wrapper-outer"
                        :class="{ '!grid-cols-1 !grid-rows-1': !showChanges }"
                    >
                        <template v-if="showChanges">
                            <span class="col-1 row-1">Reference Build</span>

                            <div class="image-wrapper left">
                                <div v-if="!screen.referenceBuildScreen" class="placeholder">
                                    <span>Screen does not exist in reference build</span>
                                </div>
                                <div v-else-if="screen.referenceBuildScreen?.imageSrc === false" class="error" />
                                <Loader v-else-if="!screen.referenceBuildScreen?.imageSrc" class="loading" />
                                <img
                                    v-else
                                    :src="screen.referenceBuildScreen?.imageSrc"
                                    :alt="`Reference screenshot: ${screen.name}`"
                                />
                            </div>

                            <span class="col-start-2 row-start-1">New Build</span>
                        </template>

                        <div class="image-wrapper right">
                            <div v-if="!screen.currentBuildScreen" class="placeholder">
                                <span>Screen has been removed</span>
                            </div>

                            <template v-else>
                                <div class="image-wrapper-inner" :class="{ 'opacity-0': showChanges && showDiff }">
                                    <div v-if="screen.currentBuildScreen?.imageSrc === false" class="error" />
                                    <Loader v-else-if="!screen.currentBuildScreen?.imageSrc" class="loading" />
                                    <img
                                        v-else
                                        :src="screen.currentBuildScreen.imageSrc"
                                        :alt="`New build screenshot: ${screen.name}`"
                                    />
                                </div>

                                <div v-if="showChanges && showDiff" class="image-wrapper-inner diff">
                                    <div v-if="!screen.referenceBuildScreen" class="placeholder">
                                        <span>No diff available since this screen is new</span>
                                    </div>
                                    <div v-else-if="screen.diffImageSrc === false" class="error" />
                                    <Loader v-else-if="!screen.diffImageSrc" class="loading" />
                                    <img v-else :src="screen.diffImageSrc" :alt="`Visual diff: ${screen.name}`" />
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="hasPendingChanges" class="button-wrapper">
                <button class="primary" @click="approveBuild">Approve</button>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import {
    AppsApi,
    BuildScreensApi,
    BuildsApi,
    type IAppShowResponse,
    type IBuildResponse,
    type IBuildScreenResponse
} from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import Loader from '@/shared/components/loader.vue';
import { dataFrom, dataFromAsync } from '@zyno-io/openapi-client-codegen';
import { formatError, handleError, handleErrorAndAlert, showAlert, showConfirm } from '@zyno-io/vue-foundation';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

interface IScreen extends IBuildScreenResponse {
    diffImageSrc?: string | false;
    currentBuildScreen?: IBuildScreenResponse['currentBuildScreen'] & {
        imageSrc?: string | false;
    };
    referenceBuildScreen?: IBuildScreenResponse['referenceBuildScreen'] & {
        imageSrc?: string | false;
    };
}

const isLoading = ref(true);

const app = ref<IAppShowResponse>();
const build = ref<IBuildResponse>();
const screens = ref<IScreen[]>();
const loadError = ref<string>();
const showChanges = ref(true);
const showDiff = ref(false);

const displayScreens = computed(() => {
    if (showChanges.value) return screens.value;
    return screens.value?.filter(screen => screen.currentBuildScreen);
});

const commitUrl = computed(() => {
    if (app.value?.commitUrlBase && build.value?.commitHash) {
        return `${app.value.commitUrlBase}/${build.value.commitHash}`;
    }
    return null;
});

const hasPendingChanges = computed(() =>
    screens.value?.some(
        screen => screen.currentBuildScreen?.status === 'new' || screen.currentBuildScreen?.status === 'needs review'
    )
);

onMounted(load);

async function load() {
    try {
        const appId = String(route.params.id);
        const buildId = String(route.params.buildId);

        const [screensResponse, appResponse, buildResponse] = await Promise.all([
            BuildScreensApi.getBuildScreensGetScreens({ path: { appId, id: buildId } }),
            AppsApi.getAppsShow({ path: { id: appId } }),
            BuildsApi.getBuildsGet({ path: { appId, id: buildId } })
        ]);

        screens.value = dataFrom(screensResponse);
        app.value = dataFrom(appResponse);
        build.value = dataFrom(buildResponse);
        loadImages();
    } catch (err) {
        handleError(err);
        loadError.value = formatError(err);
    } finally {
        isLoading.value = false;
    }
}

async function loadImages() {
    if (!screens.value) return;

    for (const screen of screens.value) {
        if (screen.currentBuildScreen) {
            getScreenImage(screen.currentBuildScreen).then(imageSrc => {
                screen.currentBuildScreen!.imageSrc = imageSrc;
            });
        }

        if (screen.referenceBuildScreen) {
            getScreenImage(screen.referenceBuildScreen).then(imageSrc => {
                screen.referenceBuildScreen!.imageSrc = imageSrc;
            });
        }

        getScreenDiff(screen).then(diffImageSrc => {
            screen.diffImageSrc = diffImageSrc;
        });
    }
}

async function getScreenImage(screen: NonNullable<IScreen['currentBuildScreen']>) {
    try {
        const response = await BuildScreensApi.getBuildScreensGetScreenImage({
            path: {
                appId: String(route.params.id),
                id: screen.matchedBuildId ?? screen.buildId,
                screenId: screen.screenId
            }
        });
        return URL.createObjectURL(response.data as Blob);
    } catch (err) {
        handleError(err);
        return false;
    }
}

async function getScreenDiff(screen: IBuildScreenResponse) {
    if (!screen.currentBuildScreen || !screen.referenceBuildScreen || screen.currentBuildScreen.status === 'no changes')
        return false;

    try {
        const response = await BuildScreensApi.getBuildScreensGetScreenDiff({
            path: {
                appId: String(route.params.id),
                id: screen.currentBuildScreen.matchedBuildId ?? screen.currentBuildScreen.buildId,
                screenId: screen.screenId
            }
        });
        return URL.createObjectURL(response.data as Blob);
    } catch (err) {
        handleError(err);
        return false;
    }
}

async function approveBuild() {
    const response = await showConfirm(`Are you sure you'd like to approve these changes?`);
    if (!response) return;

    try {
        isLoading.value = true;
        const { vcsUrl } = await dataFromAsync(
            BuildsApi.postBuildsApprove({
                path: { appId: String(route.params.id), id: String(route.params.buildId) }
            })
        );

        if (!vcsUrl) {
            await showAlert('The build was approved, but the VCS CI job could not be re-run automatically.');
            isLoading.value = false;
        } else {
            location.href = vcsUrl;
        }
    } catch (err) {
        handleErrorAndAlert(err);
        isLoading.value = false;
    }
}

function getStatusText(status: NonNullable<IBuildScreenResponse['currentBuildScreen']>['status']) {
    switch (status) {
        case 'new':
            return 'New';
        case 'no changes':
            return 'No Changes';
        case 'needs review':
            return 'Needs Review';
        case 'changes approved':
            return 'Changes Approved';
        default:
            return '';
    }
}

function getStatusStyle(status?: NonNullable<IBuildScreenResponse['currentBuildScreen']>['status']) {
    switch (status) {
        case 'changes approved':
            return 'bg-green-500/10 border-green-500/50 text-green-500';
        case 'needs review':
            return 'bg-red-500/10 border-red-500/50 text-red-500';
        case 'no changes':
            return 'bg-blue-500/10 border-blue-500/50 text-blue-500';
        default:
            return '';
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#screens {
    .commit-info {
        @apply flex items-center gap-2 text-neutral-400 text-sm max-w-[400px] no-underline;

        .truncate {
            @apply overflow-hidden text-ellipsis whitespace-nowrap;
        }

        &:is(a):hover {
            @apply text-blue-400 transition-colors;
        }
    }

    .screen-list {
        @apply flex flex-col gap-4;
    }

    .screen {
        @apply relative flex flex-col gap-4 p-4 bg-neutral-500/10 border border-neutral-500/25 rounded-md;

        .screen-meta {
            @apply flex justify-between;

            .screen-status {
                @apply px-2 py-1 border rounded-md text-sm;
            }
        }

        .image-wrapper-outer {
            @apply grid grid-cols-2 grid-rows-[30px_auto] border-t border-neutral-500/25 pt-4 gap-1 duration-500 ease-in-out;

            span {
                @apply text-center font-bold uppercase text-neutral-500;
            }

            .image-wrapper {
                @apply flex items-center justify-center bg-neutral-500/25 rounded-md relative;

                .image-wrapper-inner.diff {
                    @apply absolute top-0 left-0 w-full h-full;
                }
            }

            img {
                @apply w-full h-auto rounded-md;
            }

            .placeholder {
                @apply flex items-center justify-center bg-neutral-500/25 h-full w-full rounded-md;

                span {
                    @apply text-2xl text-neutral-500 p-24;
                }
            }

            .error {
                @apply flex items-center justify-center bg-neutral-500/25 h-full w-full rounded-md;
            }
        }
    }

    .button-wrapper {
        @apply py-4 flex gap-4 justify-end;
    }
}
</style>
