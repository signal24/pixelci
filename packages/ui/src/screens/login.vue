<template>
    <div id="login">
        <a class="title">PixelCI</a>

        <div class="card">
            <h2>Login</h2>

            <button v-for="provider in providers" class="primary" @click="login(provider)">
                Login via {{ provider.name }}
            </button>
        </div>
    </div>

    <LoaderModal v-if="isLoading" size="2xl" />
</template>

<script lang="ts" setup>
import { dataFrom, dataFromAsync, OpenApiError } from '@zyno-io/openapi-client-codegen';
import { onMounted, ref } from 'vue';

import { LOCAL_STORAGE_AUTH_KEY } from '@/openapi-client';
import { type ISessionProvider, SessionApi } from '@/openapi-client-generated';
import LoaderModal from '@/shared/components/loader-modal.vue';
import { useStore } from '@/store';
import { handleErrorAndAlert } from '@zyno-io/vue-foundation';
import { useRoute, useRouter } from 'vue-router';

const store = useStore();
const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const providers = ref<ISessionProvider[]>();
const targetPath = ref<string>();

async function login(provider: ISessionProvider) {
    try {
        isLoading.value = true;

        const { url } = await dataFromAsync(
            SessionApi.getSessionGetProviderLoginUrl({
                path: { id: provider.id },
                query: {
                    redirectUri: `${window.location.origin}/login`,
                    state: btoa(JSON.stringify({ path: location.pathname, providerId: provider.id }))
                }
            })
        );

        location.href = url;
    } catch (err) {
        handleErrorAndAlert(err);
        isLoading.value = false;
    }
}

async function processCode(code: string) {
    try {
        const state = JSON.parse(atob(route.query.state as string));

        router.replace({ path: '/login', query: {} });

        const { jwt } = await dataFromAsync(
            SessionApi.postSessionLogin({
                body: {
                    code,
                    providerId: state.providerId,
                    redirectUri: `${window.location.origin}/login`
                }
            })
        );
        targetPath.value = state.path;
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, jwt);
        loadSession();
    } catch (err) {
        handleErrorAndAlert(err);
        isLoading.value = false;
    }
}

async function load() {
    if (route.query.code) {
        return processCode(route.query.code as string);
    }

    return loadSession();
}

async function loadSession() {
    try {
        store.sessionUser = dataFrom(await SessionApi.getSessionGetIdentity());
        if (route.path === '/login') {
            router.replace(targetPath.value ?? '/');
        }
    } catch (err) {
        if (!(err instanceof OpenApiError && err.response.status === 401)) {
            return handleErrorAndAlert(err);
        }
    }

    try {
        providers.value = await dataFromAsync(SessionApi.getSessionGetProviders());
    } catch (err) {
        return handleErrorAndAlert(err);
    }

    isLoading.value = false;
}

onMounted(() => {
    router.isReady().then(load);
});
</script>

<style lang="scss" scoped>
@reference "tailwindcss";

#login {
    @apply flex-1 flex flex-col items-center justify-center;

    .card {
        @apply flex flex-col p-6 gap-1 border border-neutral-500/25 rounded-lg items-center w-96;
    }

    .title {
        @apply text-lg cursor-pointer mb-4;
    }

    h2 {
        @apply text-xl font-semibold mb-3;
    }
}
</style>
