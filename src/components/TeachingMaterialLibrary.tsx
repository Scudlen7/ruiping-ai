import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/components/Toast";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image,
  Video,
  Music,
  File,
  Trash2,
  Eye,
  ExternalLink,
  Filter,
  Search,
  Plus,
  Calendar,
  PencilLine,
  Tag,
  X,
} from "lucide-react";
import {
  TeachingMaterialUpload,
  type TeachingMaterialSaveResult,
} from "./TeachingMaterialUpload";
import { ConfirmDialog } from "./ConfirmDialog";
import { ModalWrapper } from "./ModalWrapper";
import { getErrorMessage } from "~/utils/trpcError";

interface TeachingMaterial {
  id: number;
  title: string;
  description?: string | null;
  contentType: string;
  fileUrl?: string | null;
  textContent?: string | null;
  knowledgeArea?: {
    id: number;
    name: string;
    description: string | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

type TeachingMaterialContentType =
  | "document"
  | "image"
  | "text"
  | "video"
  | "audio"
  | "other";

interface KnowledgeArea {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
}

const CONTENT_TYPE_OPTIONS: Array<{
  value: TeachingMaterialContentType;
  label: string;
}> = [
  { value: "text", label: "文本" },
  { value: "document", label: "文档" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "other", label: "其他" },
];

function isTeachingMaterialContentType(
  value: string,
): value is TeachingMaterialContentType {
  return CONTENT_TYPE_OPTIONS.some((option) => option.value === value);
}

interface TeachingMaterialLibraryProps {
  onClose?: () => void;
  showHeader?: boolean;
  variant?: "modal" | "page";
}

export function TeachingMaterialLibrary({
  onClose,
  showHeader = true,
  variant = "modal",
}: TeachingMaterialLibraryProps) {
  const toast = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(
    null,
  );
  const [selectedContentType, setSelectedContentType] = useState<
    TeachingMaterialContentType | ""
  >("");
  const [selectedKnowledgeArea, setSelectedKnowledgeArea] = useState<
    number | ""
  >("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch teaching materials
  const {
    data: materialsData,
    isLoading,
    error,
  } = useQuery({
    ...trpc.getTeachingMaterials.queryOptions({
      ...(selectedContentType && { contentType: selectedContentType }),
      ...(selectedKnowledgeArea && {
        knowledgeAreaId: selectedKnowledgeArea,
      }),
    }),
  });

  // Get knowledge areas for categorization
  const { data: knowledgeAreasData } = useQuery(trpc.getKnowledgeAreas.queryOptions());

  const knowledgeAreas: KnowledgeArea[] =
    knowledgeAreasData?.knowledgeAreas ?? [];

  // Delete material mutation
  const deleteMutation = useMutation(
    trpc.deleteTeachingMaterial.mutationOptions(),
  );

  const materials: TeachingMaterial[] = materialsData?.materials ?? [];

  // Filter materials based on search query
  const filteredMaterials = materials.filter(
    (material) =>
      material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (material.description &&
        material.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase())) ||
      material.knowledgeArea?.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const selectedMaterial =
    materials.find((material) => material.id === selectedMaterialId) ?? null;
  const navigationMaterials = filteredMaterials.some(
    (material) => material.id === selectedMaterialId,
  )
    ? filteredMaterials
    : materials;
  const selectedMaterialIndex = navigationMaterials.findIndex(
    (material) => material.id === selectedMaterialId,
  );
  const previousMaterial =
    selectedMaterialIndex > 0
      ? navigationMaterials[selectedMaterialIndex - 1]
      : null;
  const nextMaterial =
    selectedMaterialIndex >= 0 &&
    selectedMaterialIndex < navigationMaterials.length - 1
      ? navigationMaterials[selectedMaterialIndex + 1]
      : null;

  const invalidateMaterialQueries = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        JSON.stringify(query.queryKey).includes("getTeachingMaterials"),
    });
  };

  const openMaterialDetail = (materialId: number) => {
    setSelectedMaterialId(materialId);
    setIsEditingMaterial(false);
  };

  const handleDelete = (materialId: number, title: string) => {
    setDeleteTarget({ id: materialId, title });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const deletedIndex = navigationMaterials.findIndex(
        (material) => material.id === deleteTarget.id,
      );
      const fallbackMaterial =
        deletedIndex >= 0
          ? (navigationMaterials[deletedIndex + 1] ??
            navigationMaterials[deletedIndex - 1] ??
            null)
          : null;

      await deleteMutation.mutateAsync({
        materialId: deleteTarget.id,
      });
      toast.success("教学资料删除成功");
      await invalidateMaterialQueries();
      if (selectedMaterialId === deleteTarget.id) {
        setSelectedMaterialId(fallbackMaterial?.id ?? null);
        setIsEditingMaterial(false);
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUploadSuccess = async () => {
    setShowUpload(false);
    await invalidateMaterialQueries();
  };

  const handleEditSuccess = async (material?: TeachingMaterialSaveResult) => {
    await invalidateMaterialQueries();
    if (material?.id) {
      setSelectedMaterialId(material.id);
    }
    setIsEditingMaterial(false);
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="h-5 w-5 text-blue-500" />;
      case "video":
        return <Video className="h-5 w-5 text-purple-500" />;
      case "audio":
        return <Music className="h-5 w-5 text-green-500" />;
      case "text":
        return <FileText className="h-5 w-5 text-gray-500" />;
      default:
        return <File className="h-5 w-5 text-orange-500" />;
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "image":
        return "图片";
      case "video":
        return "视频";
      case "audio":
        return "音频";
      case "text":
        return "文本";
      case "document":
        return "文档";
      default:
        return "其他";
    }
  };

  const formatDate = (dateValue: Date | string) => {
    return new Date(dateValue).toLocaleDateString("zh-CN");
  };

  const getPreviewKind = (material: TeachingMaterial) => {
    if (material.contentType === "image" && material.fileUrl) return "image";
    if (material.contentType === "video" && material.fileUrl) return "video";
    if (material.contentType === "audio" && material.fileUrl) return "audio";
    if (
      material.fileUrl &&
      (material.fileUrl.toLowerCase().includes(".pdf") ||
        material.contentType === "document")
    ) {
      return "document";
    }
    if (material.textContent?.trim()) return "text";
    return "generic";
  };

  const getMaterialContentType = (
    material: TeachingMaterial,
  ): TeachingMaterialContentType =>
    isTeachingMaterialContentType(material.contentType)
      ? material.contentType
      : "other";

  if (showUpload) {
    return (
      <TeachingMaterialUpload
        onSuccess={() => {
          void handleUploadSuccess();
        }}
        onClose={() => setShowUpload(false)}
        variant={variant}
      />
    );
  }

  return (
    <div
      className={
        variant === "page"
          ? "rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          : "rounded-lg bg-white p-6 shadow-lg"
      }
    >
      {showHeader ? (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">教学资料库</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              添加资料
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加资料
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="搜索教学资料..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedContentType}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedContentType(
                  isTeachingMaterialContentType(value) ? value : "",
                );
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">所有类型</option>
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {knowledgeAreas.length > 0 && (
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <select
                value={selectedKnowledgeArea}
                onChange={(e) =>
                  setSelectedKnowledgeArea(
                    e.target.value ? parseInt(e.target.value) : "",
                  )
                }
                className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">所有知识领域</option>
                {knowledgeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-sm text-gray-500">
            共 {filteredMaterials.length} 份资料
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="py-12 text-center">
          <p className="text-red-600">加载教学资料时出错，请刷新页面重试</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredMaterials.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-4 text-gray-600">
            {searchQuery || selectedContentType
              ? "没有找到匹配的教学资料"
              : "还没有上传任何教学资料"}
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            上传第一份资料
          </button>
        </div>
      )}

      {/* Materials Grid */}
      {!isLoading && !error && filteredMaterials.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMaterials.map((material) => (
            <div
              key={material.id}
              role="button"
              tabIndex={0}
              onClick={() => openMaterialDetail(material.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openMaterialDetail(material.id);
                }
              }}
              className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-shadow hover:border-blue-200 hover:shadow-md"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getContentTypeIcon(material.contentType)}
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    {getContentTypeLabel(material.contentType)}
                  </span>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(material.id, material.title);
                  }}
                  className="text-gray-400 hover:text-red-600"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <h3 className="mb-2 line-clamp-2 font-medium text-gray-900">
                {material.title}
              </h3>

              {material.description && (
                <p className="mb-3 line-clamp-2 text-sm text-gray-600">
                  {material.description}
                </p>
              )}

              {/* Knowledge Area */}
              {material.knowledgeArea && (
                <div className="mb-3 flex items-center space-x-1">
                  <Tag className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {material.knowledgeArea.name}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(material.createdAt)}</span>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openMaterialDetail(material.id);
                  }}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                >
                  <Eye className="h-3 w-3" />
                  <span>详情</span>
                </button>
              </div>

              {/* Text Content Preview */}
              {material.contentType === "text" && material.textContent && (
                <div className="mt-3 line-clamp-3 rounded bg-gray-50 p-2 text-xs text-gray-600">
                  {material.textContent}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除教学资料"
        message={`确定要删除教学资料"${deleteTarget?.title}"吗？此操作不可撤销。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ModalWrapper
        isOpen={selectedMaterialId !== null}
        onClose={() => {
          setSelectedMaterialId(null);
          setIsEditingMaterial(false);
        }}
        maxWidth={isEditingMaterial ? "max-w-6xl" : "max-w-5xl"}
      >
        {selectedMaterial ? (
          isEditingMaterial ? (
            <div className="max-h-[90vh] overflow-y-auto px-6 py-6">
              <TeachingMaterialUpload
                mode="edit"
                initialMaterial={{
                  id: selectedMaterial.id,
                  title: selectedMaterial.title,
                  description: selectedMaterial.description,
                  contentType: getMaterialContentType(selectedMaterial),
                  fileUrl: selectedMaterial.fileUrl,
                  textContent: selectedMaterial.textContent,
                  knowledgeAreaId: selectedMaterial.knowledgeArea?.id,
                }}
                onSuccess={(material) => {
                  void handleEditSuccess(material);
                }}
                onClose={() => setIsEditingMaterial(false)}
                variant="page"
              />
            </div>
          ) : (
            <div className="max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        {getContentTypeIcon(selectedMaterial.contentType)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {getContentTypeLabel(selectedMaterial.contentType)}
                      </span>
                      {selectedMaterial.knowledgeArea ? (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">
                          {selectedMaterial.knowledgeArea.name}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        {selectedMaterialIndex >= 0
                          ? `${selectedMaterialIndex + 1} / ${navigationMaterials.length}`
                          : `共 ${materials.length} 份`}
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-slate-950">
                      {selectedMaterial.title}
                    </h3>
                    {selectedMaterial.description ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        {selectedMaterial.description}
                      </p>
                    ) : (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        暂未填写资料说明。你可以进入编辑模式补充适用年级、课堂用途和使用建议。
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        previousMaterial &&
                        openMaterialDetail(previousMaterial.id)
                      }
                      disabled={!previousMaterial}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一篇
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        nextMaterial && openMaterialDetail(nextMaterial.id)
                      }
                      disabled={!nextMaterial}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      下一篇
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMaterial(true)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <PencilLine className="h-4 w-4" />
                      编辑资料
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMaterialId(null);
                        setIsEditingMaterial(false);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                  {getPreviewKind(selectedMaterial) === "image" &&
                  selectedMaterial.fileUrl ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img
                        src={selectedMaterial.fileUrl}
                        alt={selectedMaterial.title}
                        className="max-h-[560px] w-full object-contain"
                      />
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "video" &&
                  selectedMaterial.fileUrl ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                      <video
                        src={selectedMaterial.fileUrl}
                        controls
                        className="max-h-[560px] w-full"
                      />
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "audio" &&
                  selectedMaterial.fileUrl ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        音频内容
                      </div>
                      <audio
                        src={selectedMaterial.fileUrl}
                        controls
                        className="w-full"
                      />
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "document" &&
                  selectedMaterial.fileUrl &&
                  selectedMaterial.fileUrl.toLowerCase().includes(".pdf") ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <iframe
                        src={selectedMaterial.fileUrl}
                        title={selectedMaterial.title}
                        className="h-[620px] w-full"
                      />
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "text" ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        内容预览
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {selectedMaterial.textContent}
                      </div>
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "document" &&
                  (!selectedMaterial.fileUrl ||
                    !selectedMaterial.fileUrl
                      .toLowerCase()
                      .includes(".pdf")) ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        文档说明
                      </div>
                      <p className="text-sm leading-7 text-slate-600">
                        当前资料已归档为文档类型。若为 Word、Excel
                        或其他文件格式，可以通过右侧按钮在新标签页查看原文件。
                      </p>
                      {selectedMaterial.textContent ? (
                        <div className="mt-4 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-7 text-slate-700 ring-1 ring-slate-100">
                          {selectedMaterial.textContent}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {getPreviewKind(selectedMaterial) === "generic" ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                        {getContentTypeIcon(selectedMaterial.contentType)}
                      </span>
                      <div className="mt-4 text-base font-bold text-slate-900">
                        这份资料暂不支持内嵌预览
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        你仍然可以通过右侧信息区查看元数据，或直接打开原文件。
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        继续浏览资料库
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        可以快速切换到上一份或下一份资料，连续检查讲义内容。
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          previousMaterial &&
                          openMaterialDetail(previousMaterial.id)
                        }
                        disabled={!previousMaterial}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        上一篇
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          nextMaterial && openMaterialDetail(nextMaterial.id)
                        }
                        disabled={!nextMaterial}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        下一篇
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">
                      资料信息
                    </div>
                    <div className="mt-4 space-y-4 text-sm">
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            创建时间
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {formatDate(selectedMaterial.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            最近更新
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {formatDate(selectedMaterial.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Tag className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            知识点
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {selectedMaterial.knowledgeArea?.name || "未关联"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Eye className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            资料类型
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {getContentTypeLabel(selectedMaterial.contentType)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">
                      资料操作
                    </div>
                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingMaterial(true)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <PencilLine className="h-4 w-4" />
                        编辑当前资料
                      </button>
                      {selectedMaterial.fileUrl ? (
                        <a
                          href={selectedMaterial.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                          打开原文件
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            selectedMaterial.id,
                            selectedMaterial.title,
                          )
                        }
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        删除当前资料
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )
        ) : null}
      </ModalWrapper>
    </div>
  );
}
