<template>
    <div id="builds">
        <LoaderModal v-if="isLoading" />

        <template v-else>
            <div v-if="app" class="header">
                <div class="flex gap-4 items-center">
                    <RouterLink :to="`/apps`">
                        <button class="back">
                            <i class="fa fa-arrow-left" />
                        </button>
                    </RouterLink>
                    <h1>{{ app.name }}</h1>
                </div>
                <select v-model="selectedBranchId">
                    <option value="">All Branches</option>
                    <option v-for="branch in branches" :value="branch.id">{{ branch.name }}</option>
                </select>
            </div>

            <div class="build-list">
                <LoaderModal v-if="isLoadingBuilds" />
                <div v-else-if="!builds.length" class="empty">
                    <i class="fa fa-magnifying-glass" />
                    <h2>No builds found{{ selectedBranchId && ' for this branch' }}</h2>
                </div>
                <div v-for="build in builds" class="build" @click="viewBuild(build)">
                    <div>
                        <label><i class="fa fa-code-branch fa-sm fa-fw" /></label>
                        <span>{{ build.branchName }}</span>
                    </div>
                    <a
                        v-if="app?.commitUrlBase && build.commitHash"
                        class="pr-6 commit-link"
                        :href="`${app.commitUrlBase}/${build.commitHash}`"
                        target="_blank"
                        v-tooltip="build.commitSubject"
                        @click.stop
                    >
                        <label><i class="fa fa-code-commit fa-sm fa-fw" /></label>
                        <div class="flex flex-col w-full">
                            <span class="font-mono">{{ build.commitHash?.substring(0, 8) }}</span>
                            <span class="truncate">{{ build.commitSubject }}</span>
                        </div>
                    </a>
                    <div v-else class="pr-6" v-tooltip="build.commitSubject">
                        <label><i class="fa fa-code-commit fa-sm fa-fw" /></label>
                        <div class="flex flex-col w-full">
                            <span class="font-mono">{{ build.commitHash?.substring(0, 8) }}</span>
                            <span class="truncate">{{ build.commitSubject }}</span>
                        </div>
                    </div>
                    <div>
                        <label><i class="fa fa-user fa-sm fa-fw" /></label>
                        <span>{{ build.commitAuthor.replace(/<.*?>/, '') }}</span>
                    </div>
                    <div>
                        <label><i class="fa fa-calendar-days fa-sm fa-fw" /></label>
                        <div class="flex flex-col">
                            <span class="build-date">{{ $filters.dateTime(build.createdAt, 'M/d/yy H:mm') }}</span>
                        </div>
                    </div>
                    <div class="justify-end">
                        <div class="status" :class="getStatusStyle(build.status)">
                            <div class="flex items-center gap-2">
                                <!-- approved -->
                                <i class="fa fa-check fa-sm fa-fw" v-if="build.status === 'changes approved'" />
                                <!-- processing -->
                                <i class="fa fa-stopwatch fa-sm fa-fw" v-if="build.status === 'processing'" />
                                <!-- needs review -->
                                <i
                                    class="fa fa-magnifying-glass fa-sm fa-fw text-inherit"
                                    v-if="build.status === 'needs review'"
                                />
                                <!-- draft -->
                                <i class="fa fa-pen-to-square fa-sm fa-fw" v-if="build.status === 'draft'" />
                                <!-- no changes -->
                                <i class="fa fa-check fa-sm fa-fw" v-if="build.status === 'no changes'" />
                                <!-- failed -->
                                <i class="fa fa-xmark fa-sm fa-fw" v-if="build.status === 'failed'" />
                                <span>{{ getStatusText(build.status) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import {
    AppsApi,
    BranchesApi,
    BuildsApi,
    type IAppShowResponse,
    type IBranchResponse,
    type IBuildResponse
} from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import { useStore } from '@/store';
import { dataFrom } from '@zyno-io/openapi-client-codegen';
import { handleErrorAndAlert } from '@zyno-io/vue-foundation';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const store = useStore();

const app = ref<IAppShowResponse>();
const branches = ref<IBranchResponse[]>();
const selectedBranchId = ref<string>('');

const builds = ref<IBuildResponse[]>([]);
const isLoading = ref(true);
const isLoadingBuilds = ref(true);

onMounted(() => {
    if (store.selectedBranchId) selectedBranchId.value = store.selectedBranchId;
    loadBranches();
    loadBuilds();
});

watch(selectedBranchId, () => {
    store.selectedBranchId = selectedBranchId.value;
    loadBuilds();
});

async function loadBranches() {
    try {
        branches.value = dataFrom(await BranchesApi.getBranchesIndex({ path: { appId: String(route.params.id) } }));
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isLoading.value = false;
    }
}

async function loadBuilds() {
    try {
        isLoadingBuilds.value = true;

        app.value = dataFrom(await AppsApi.getAppsShow({ path: { id: String(route.params.id) } }));
        builds.value = dataFrom(
            await BuildsApi.getBuildsIndex({
                path: { appId: String(route.params.id) },
                query: { branchId: selectedBranchId.value || undefined }
            })
        );
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isLoadingBuilds.value = false;
    }
}

function viewBuild(build: IBuildResponse) {
    router.push({ path: `/apps/${app.value!.id}/builds/${build.id}` });
}

function getStatusStyle(status: IBuildResponse['status']) {
    switch (status) {
        case 'changes approved':
            return 'bg-green-500/10 border-green-500/50 text-green-500';
        case 'processing':
            return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500';
        case 'needs review':
            return 'bg-red-500/10 border-red-500/50 text-red-500';
        case 'draft':
            return 'bg-neutral-500/10 border-neutral-500/50 text-neutral-500';
        case 'no changes':
            return 'bg-blue-500/10 border-blue-500/50 text-blue-500';
        case 'failed':
            return 'bg-red-500/10 border-red-500/50 text-red-500';
        default:
            return '';
    }
}

function getStatusText(status: IBuildResponse['status']) {
    switch (status) {
        case 'changes approved':
            return 'Approved';
        case 'processing':
            return 'Processing';
        case 'needs review':
            return 'Needs Review';
        case 'draft':
            return 'Draft';
        case 'no changes':
            return 'No Changes';
        case 'failed':
            return 'Failed';
        default:
            return status;
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#builds {
    .build-list {
        @apply flex flex-col gap-4;
    }

    .build {
        @apply items-center p-4 border bg-neutral-500/10 border-neutral-500/25 rounded-md grid grid-cols-[150px_1.5fr_1fr_160px_150px] gap-4 duration-75 cursor-pointer;

        &:hover {
            @apply bg-neutral-500/15;
        }

        > div,
        > a {
            @apply flex items-center gap-2 overflow-hidden w-full;

            span.truncate {
                @apply text-nowrap text-ellipsis w-full;
            }
        }

        label {
            @apply text-neutral-500 cursor-pointer;
        }

        .commit-link {
            @apply no-underline text-inherit hover:text-blue-400 transition-colors;
        }

        .status {
            @apply flex items-center justify-center gap-1 border rounded-md text-xs p-1 w-[150px];
        }
    }

    .empty {
        @apply flex flex-col items-center justify-center min-h-[300px] gap-6 p-4 rounded-md text-neutral-500/50 text-lg;

        i {
            @apply text-5xl;
        }
    }
}
</style>
