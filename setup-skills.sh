#!/bin/bash

echo "Instalando skills para o projeto..."

npx skills add anthropics/skills@webapp-testing
npx skills add cloudai-x/threejs-skills@threejs-animation
npx skills add coreyhaines31/marketingskills@seo-audit
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/tool-belt/skills --skill landing-page-design
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max

echo "Instalação concluída!"
