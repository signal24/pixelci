<template>
    <div id="admin-users">
        <LoaderModal v-if="isLoading" />

        <template v-else>
            <div class="header">
                <h1>Users</h1>
            </div>

            <div class="list">
                <div v-if="!users?.length" class="empty">
                    <i class="fa fa-users" />
                    <h2>No users</h2>
                </div>
                <div v-for="user in users" :key="user.id" class="item">
                    <div class="item-info">
                        <span class="name">{{ user.name }}</span>
                        <span v-if="user.id === currentUserId" class="badge you">You</span>
                        <span class="meta">{{ user.vcsName }}</span>
                    </div>
                    <div class="item-details">
                        <span class="meta">Last login: {{ $filters.dateTime(user.lastLoginAt, 'M/d/yy H:mm') }}</span>
                    </div>
                    <div class="item-actions">
                        <label class="toggle" :class="{ disabled: user.id === currentUserId }">
                            <input
                                type="checkbox"
                                :checked="user.isAdmin"
                                :disabled="user.id === currentUserId"
                                @change="toggleAdmin(user, $event)"
                            />
                            <span class="toggle-track">
                                <span class="toggle-dot" />
                            </span>
                            <span class="toggle-label">Admin</span>
                        </label>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { UsersApi, type IuserListResponse } from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import { useStore } from '@/store';
import { dataFrom, dataFromAsync } from '@zyno-io/openapi-client-codegen';
import { handleErrorAndAlert, showConfirm } from '@zyno-io/vue-foundation';
import { computed, onMounted, ref } from 'vue';

const store = useStore();
const users = ref<IuserListResponse[]>();
const isLoading = ref(true);

const currentUserId = computed(() => store.sessionUser?.id);

onMounted(load);

async function load() {
    try {
        users.value = dataFrom(await UsersApi.getUsersIndex());
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isLoading.value = false;
    }
}

async function toggleAdmin(user: IuserListResponse, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const newValue = checkbox.checked;

    if (!newValue) {
        const ok = await showConfirm(`Revoke admin from "${user.name}"?`);
        if (!ok) {
            checkbox.checked = true;
            return;
        }
    }

    try {
        const result = await dataFromAsync(
            UsersApi.putUsersUpdate({
                path: { id: user.id },
                body: { isAdmin: newValue }
            })
        );
        user.isAdmin = result.isAdmin;
    } catch (err) {
        checkbox.checked = !newValue;
        handleErrorAndAlert(err);
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#admin-users {
    .list {
        @apply flex flex-col gap-4;
    }

    .item {
        @apply p-4 bg-neutral-500/10 border border-neutral-500/25 rounded-md flex justify-between items-center;

        .item-info {
            @apply flex items-center gap-3;

            .name {
                @apply font-medium;
            }

            .badge {
                @apply text-xs px-2 py-0.5 rounded;

                &.you {
                    @apply bg-neutral-500/20 text-neutral-400 border border-neutral-500/30;
                }
            }

            .meta {
                @apply text-sm text-neutral-400;
            }
        }

        .item-details {
            .meta {
                @apply text-sm text-neutral-400;
            }
        }

        .item-actions {
            @apply flex gap-2;

            .toggle {
                @apply flex items-center gap-2 cursor-pointer select-none;

                &.disabled {
                    @apply opacity-40 cursor-not-allowed;
                }

                input {
                    @apply hidden;
                }

                .toggle-track {
                    @apply relative w-9 h-5 bg-neutral-600 rounded-full transition-colors duration-150;
                }

                input:checked + .toggle-track {
                    @apply bg-blue-500;
                }

                .toggle-dot {
                    @apply absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-150;
                }

                input:checked + .toggle-track .toggle-dot {
                    @apply translate-x-4;
                }

                .toggle-label {
                    @apply text-sm text-neutral-400;
                }
            }
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
