# app-template 接入 GitHub Packages（npm）方案

## 目标
将 `MSPbotsAI/app-template` 改造成组织级 npm 包发布模板，使基于该模板创建的新仓库默认具备：
- `@app/*` scope 约束
- GitHub Packages registry 配置
- 仅允许 GitHub Actions 自动发布
- 可复制的 README/工作流规范

## 非目标
- 不将 `app-template` 自身直接作为发布到 GitHub Packages 的业务包
- 不在模板中写入任何明文 token
- 不允许本机手工 publish

## 变更点
1. 根目录 `.npmrc`
   - 从 `npm.mspbots.ai` 切换到 `@app` scope 的 GitHub Packages registry
2. 新增 `.github/workflows/publish-npm.yml`
   - tag 触发自动发布
3. 更新 `README.md`
   - 增加组织发布规范与使用说明
4. 保留 `.github/workflows/auto-init.yml`
   - 模板仓库初始化逻辑继续有效

## 验证
1. 提交到 `app-template`
2. 基于修改后的模板创建 `app-test8`
3. 验证 `app-test8` 是否继承 `.npmrc` / workflow / README 说明
4. 如需要，再对 `app-test8` 设置具体 `package.json` 名称为 `@app/app-test8`
