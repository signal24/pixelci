<template>
    <div id="onboarding">
        <a class="title">PixelCI</a>

        <div class="card">
            <h2>Welcome to PixelCI</h2>
            <p class="subtitle">Let's set up your first VCS integration to get started.</p>

            <form @submit.prevent="submit">
                <label>
                    Integration Name
                    <input v-model="form.name" type="text" placeholder="e.g. My GitLab" required />
                </label>

                <label>
                    Platform
                    <select v-model="form.platform" required>
                        <option value="gitlab">GitLab</option>
                    </select>
                </label>

                <label>
                    GitLab URL
                    <input v-model="form.url" type="url" placeholder="https://gitlab.example.com" required />
                </label>

                <label>
                    Client ID
                    <input v-model="form.clientId" type="text" required />
                </label>

                <label>
                    Client Secret
                    <input v-model="form.clientSecret" type="text" required />
                </label>

                <div class="redirect-url">
                    <span class="redirect-label">OAuth Redirect URI</span>
                    <code>{{ redirectUrl }}</code>
                    <button type="button" class="copy-btn" @click="copyRedirectUrl">
                        <i class="fa fa-copy" /> Copy
                    </button>
                    <p class="hint">Use this URL as the redirect URI when configuring your GitLab OAuth application.</p>
                </div>

                <button type="submit" class="primary" :disabled="isSubmitting">
                    {{ isSubmitting ? 'Creating...' : 'Create Integration' }}
                </button>
            </form>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { dataFromAsync } from '@zyno-io/openapi-client-codegen';
import { handleErrorAndAlert } from '@zyno-io/vue-foundation';
import { computed, reactive, ref } from 'vue';

import { SessionApi } from '@/openapi-client-generated';

const emit = defineEmits<{ complete: [] }>();

const form = reactive({
    name: '',
    platform: 'gitlab' as const,
    url: '',
    clientId: '',
    clientSecret: ''
});

const isSubmitting = ref(false);

const redirectUrl = computed(() => `${window.location.origin}/login`);

async function copyRedirectUrl() {
    await navigator.clipboard.writeText(redirectUrl.value);
}

async function submit() {
    try {
        isSubmitting.value = true;
        await dataFromAsync(
            SessionApi.postSessionCreateOnboardingVcsIntegration({
                body: {
                    name: form.name,
                    platform: form.platform,
                    config: {
                        url: form.url,
                        clientId: form.clientId,
                        clientSecret: form.clientSecret
                    }
                }
            })
        );
        emit('complete');
    } catch (err) {
        handleErrorAndAlert(err);
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#onboarding {
    @apply flex-1 flex flex-col items-center justify-center;

    .title {
        @apply text-lg cursor-pointer mb-4;
    }

    .card {
        @apply flex flex-col p-6 gap-1 border border-neutral-500/25 rounded-lg items-center w-[480px];
    }

    h2 {
        @apply text-xl font-semibold mb-1;
    }

    .subtitle {
        @apply text-neutral-400 text-sm mb-4;
    }

    form {
        @apply flex flex-col gap-3 w-full;

        label {
            @apply flex flex-col gap-1 text-sm font-medium;
        }

        input,
        select {
            @apply border border-neutral-500/25 rounded px-3 py-2 bg-transparent text-sm;
        }

        .redirect-url {
            @apply flex flex-col gap-1 p-3 bg-neutral-500/10 rounded border border-neutral-500/25;

            .redirect-label {
                @apply text-sm font-medium;
            }

            code {
                @apply text-xs bg-neutral-500/15 p-2 rounded break-all select-all;
            }

            .copy-btn {
                @apply self-start text-xs mt-1;
            }

            .hint {
                @apply text-xs text-neutral-400 mt-1;
            }
        }

        button.primary {
            @apply mt-2;
        }
    }
}
</style>
