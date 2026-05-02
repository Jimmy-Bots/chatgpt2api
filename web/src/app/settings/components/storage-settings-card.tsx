"use client";

import { Database, LoaderCircle, Save, ServerCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useSettingsStore } from "../store";

const STORAGE_TYPE_OPTIONS = [
  { value: "json", label: "JSON 文件" },
  { value: "sqlite", label: "SQLite" },
  { value: "postgres", label: "PostgreSQL" },
  { value: "git", label: "Git 仓库" },
] as const;

function OverrideHint({ active, text }: { active?: boolean; text: string }) {
  if (!active) {
    return null;
  }
  return <p className="text-xs text-amber-600">{text}</p>;
}

export function StorageSettingsCard() {
  const storageConfig = useSettingsStore((state) => state.storageConfig);
  const storageEnvOverrides = useSettingsStore((state) => state.storageEnvOverrides);
  const isLoadingStorage = useSettingsStore((state) => state.isLoadingStorage);
  const isSavingStorage = useSettingsStore((state) => state.isSavingStorage);
  const isRestartingService = useSettingsStore((state) => state.isRestartingService);
  const migrateStorageData = useSettingsStore((state) => state.migrateStorageData);
  const setStorageType = useSettingsStore((state) => state.setStorageType);
  const setStorageField = useSettingsStore((state) => state.setStorageField);
  const setMigrateStorageData = useSettingsStore((state) => state.setMigrateStorageData);
  const saveStorage = useSettingsStore((state) => state.saveStorage);
  const saveStorageAndRestart = useSettingsStore((state) => state.saveStorageAndRestart);

  if (isLoadingStorage) {
    return (
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardContent className="flex items-center justify-center p-10">
          <LoaderCircle className="size-5 animate-spin text-stone-400" />
        </CardContent>
      </Card>
    );
  }

  if (!storageConfig) {
    return null;
  }

  const isDatabase = storageConfig.type === "sqlite" || storageConfig.type === "postgres";
  const isGit = storageConfig.type === "git";
  const isBusy = isSavingStorage || isRestartingService;

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
            <Database className="size-5 text-stone-600" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">存储配置</h2>
            <p className="text-sm text-stone-500">
              可在这里切换账号与用户密钥的存储方式。建议切换时勾选迁移现有数据，避免号池和密钥丢失。
            </p>
          </div>
        </div>

        {storageEnvOverrides && Object.values(storageEnvOverrides).some(Boolean) ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            当前显示的是环境变量带入的初始配置。只要你在这里保存一次，后续将优先使用页面保存的配置，不再继续被这些环境变量覆盖。
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-stone-700">存储类型</label>
            <Select value={storageConfig.type} onValueChange={(value) => setStorageType(value as typeof storageConfig.type)}>
              <SelectTrigger className="border-stone-200 bg-white">
                <SelectValue placeholder="请选择存储类型" />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_TYPE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <OverrideHint active={storageEnvOverrides?.type} text="当前值来自部署环境中的 STORAGE_BACKEND，保存后会改为使用页面配置。" />
          </div>

          {isDatabase ? (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-stone-700">数据库连接字符串</label>
              <Input
                value={storageConfig.database_url}
                onChange={(event) => setStorageField("database_url", event.target.value)}
                placeholder={storageConfig.type === "sqlite" ? "sqlite:////app/data/accounts.db" : "postgresql://user:password@host:5432/dbname"}
                className="h-10 rounded-xl border-stone-200 bg-white font-mono"
              />
              <p className="text-xs text-stone-500">留空时，SQLite 会自动使用本地默认数据库文件。</p>
              <OverrideHint active={storageEnvOverrides?.database_url} text="当前值来自部署环境中的 DATABASE_URL，保存后会改为使用页面配置。" />
            </div>
          ) : null}

          {isGit ? (
            <>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-stone-700">Git 仓库地址</label>
                <Input
                  value={storageConfig.git_repo_url}
                  onChange={(event) => setStorageField("git_repo_url", event.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="h-10 rounded-xl border-stone-200 bg-white font-mono"
                />
                <OverrideHint active={storageEnvOverrides?.git_repo_url} text="当前值来自部署环境中的 GIT_REPO_URL，保存后会改为使用页面配置。" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">Git Token</label>
                <Input
                  type="password"
                  value={storageConfig.git_token}
                  onChange={(event) => setStorageField("git_token", event.target.value)}
                  placeholder={storageConfig.git_token_masked ? "已保存，如需修改请重新输入" : "请输入 Git Token"}
                  className="h-10 rounded-xl border-stone-200 bg-white font-mono"
                />
                <OverrideHint active={storageEnvOverrides?.git_token} text="当前值来自部署环境中的 GIT_TOKEN，保存后会改为使用页面配置。" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">分支</label>
                <Input
                  value={storageConfig.git_branch}
                  onChange={(event) => setStorageField("git_branch", event.target.value)}
                  placeholder="main"
                  className="h-10 rounded-xl border-stone-200 bg-white font-mono"
                />
                <OverrideHint active={storageEnvOverrides?.git_branch} text="当前值来自部署环境中的 GIT_BRANCH，保存后会改为使用页面配置。" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">账号文件路径</label>
                <Input
                  value={storageConfig.git_file_path}
                  onChange={(event) => setStorageField("git_file_path", event.target.value)}
                  placeholder="accounts.json"
                  className="h-10 rounded-xl border-stone-200 bg-white font-mono"
                />
                <OverrideHint active={storageEnvOverrides?.git_file_path} text="当前值来自部署环境中的 GIT_FILE_PATH，保存后会改为使用页面配置。" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-stone-700">密钥文件路径</label>
                <Input
                  value={storageConfig.git_auth_keys_file_path}
                  onChange={(event) => setStorageField("git_auth_keys_file_path", event.target.value)}
                  placeholder="auth_keys.json"
                  className="h-10 rounded-xl border-stone-200 bg-white font-mono"
                />
                <OverrideHint active={storageEnvOverrides?.git_auth_keys_file_path} text="当前值来自部署环境中的 GIT_AUTH_KEYS_FILE_PATH，保存后会改为使用页面配置。" />
              </div>
            </>
          ) : null}
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          <Checkbox checked={migrateStorageData} onCheckedChange={(checked) => setMigrateStorageData(Boolean(checked))} />
          迁移现有账号和用户密钥到新存储
        </label>

        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
          保存配置后，当前服务会立即切换到新存储；如果你希望部署状态也完全刷新，可以继续点击“保存并重启服务”。
        </div>

        <div className="flex flex-col justify-end gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-stone-200 bg-white px-5 text-stone-700"
            onClick={() => void saveStorage()}
            disabled={isBusy}
          >
            {isSavingStorage ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存配置
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800"
            onClick={() => void saveStorageAndRestart()}
            disabled={isBusy}
          >
            {isRestartingService ? <LoaderCircle className="size-4 animate-spin" /> : <ServerCog className="size-4" />}
            保存并重启服务
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
