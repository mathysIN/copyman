export NEXT_DISABLE_ESLINT=1
export NEXT_DISABLE_TYPECHECK=1
export NODE_OPTIONS="--max-old-space-size=4096"
export NODE_ENV=production""
npm run build --turbo
npm run start-socket 
