import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../backend/openapi.json',
  output: 'src/generated',
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/typescript',
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      queryKeys: true,
      mutationOptions: true,
    },
  ],
});
