import { defineConfig } from 'mspack'
import react from '@mspbots/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  publicDir: 'public',
  plugins: [
    react({
      system: {
        app: {
          name: 'MSPbots AI',
          title: 'MSPbots Agent',
        },
        auth: {
          enabled: true,
          target: ({ dev }) => {
            if (dev) {
              return 'https://agentint.mspbots.ai/apps/mb-platform-user/login'
            }
            return '/apps/mb-platform-user/login'
          },
        },
        layout: {
          sidebar: {
            showUserMenu: true,
          },
        },
      },
    }),
  ],
  
  vite: {
    plugins: [tailwindcss()],
  },
  
  server: {
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
})