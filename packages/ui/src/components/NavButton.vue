<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from "vue-router";
defineProps<{to:RouteLocationRaw}>();
</script>
<template><RouterLink :to="to" class="el-button el-button--primary is-plain navigation-button"><span><slot/></span></RouterLink></template>
