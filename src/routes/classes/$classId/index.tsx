import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  Suspense,
  lazy,
} from "react";
import { z } from "zod";
import type { AppRouter } from "~/server/trpc/root";
import { AddStudentModal } from "~/components/AddStudentModal";
import { ArchiveClassModal } from "~/components/ArchiveClassModal";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { ClassPerformanceChart } from "~/components/ClassPerformanceChart";
import {
  ClassStudents,
  type ClassStudentRecord,
} from "~/components/class/ClassStudents";
import { DashboardShell } from "~/components/dashboard/DashboardShell";
import { EmptyState, MetricCard, ModuleButton, Panel } from "~/components/dashboard/ui";
import { EnhancedTeacherAssignmentUpload } from "~/components/EnhancedTeacherAssignmentUpload";
import { GroupSelectionModal } from "~/components/GroupSelectionModal";
import { ModalWrapper } from "~/components/ModalWrapper";
import { ReportGenerationModal } from "~/components/ReportGenerationModal";
import { TimeRangeSelector } from "~/components/TimeRangeSelector";
import { useToast } from "~/components/Toast";
import { useAuthStore } from "~/stores/authStore";
import { useTRPC } from "~/trpc/react";
import { getErrorMessage } from "~/utils/trpcError";
import {
  Archive,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Sparkles,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

const TeachingMaterialLibrary = lazy(() =>
  import("~/components/TeachingMaterialLibrary").then((module) => ({
    default: module.TeachingMaterialLibrary,
  })),
);
const TargetedQuestionGenerator = lazy(() =>
  import("~/components/TargetedQuestionGenerator").then((module) => ({
    default: module.TargetedQuestionGenerator,
  })),
);

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ClassRecord = RouterOutputs["getClassStudents"]["class"];
const classDetailParamsSchema = z.object({
  classId: z.string(),
});
const classDetailSearchSchema = z.object({
  open: z.enum(["upload"]).optional(),
});

export const Route = createFileRoute("/classes/$classId/")({
  validateSearch: classDetailSearchSchema,
  component: ClassDetail,
});

function ClassDetail() {
  const navigate = useNavigate();
  const { classId } = classDetailParamsSchema.parse(Route.useParams());
  const search = classDetailSearchSchema.parse(Route.useSearch());
  const classIdNumber = Number.parseInt(classId, 10);
  const { teacher } = useAuthStore();
  const trpc = useTRPC();
  const toast = useToast();

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAssignmentUpload, setShowAssignmentUpload] = useState(false);
  const [showInvitationCode, setShowInvitationCode] = useState(false);
  const [timeRange, setTimeRange] = useState<
    "7d" | "30d" | "90d" | "1y" | "all"
  >("30d");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showTeachingMaterials, setShowTeachingMaterials] = useState(false);
  const [showQuestionGenerator, setShowQuestionGenerator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStudent, setSelectedStudent] =
    useState<ClassStudentRecord | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedStudentForGroup, setSelectedStudentForGroup] =
    useState<ClassStudentRecord | null>(null);

  const refreshInvitationCodeMutation = useMutation(
    trpc.refreshInvitationCode.mutationOptions(),
  );
  const deleteStudentMutation = useMutation(
    trpc.deleteStudentFromClass.mutationOptions(),
  );
  const toggleSpecialAttentionMutation = useMutation(
    trpc.toggleSpecialAttention.mutationOptions(),
  );
  const assignStudentToGroupMutation = useMutation(
    trpc.assignStudentToGroup.mutationOptions(),
  );
  const createStudentGroupMutation = useMutation(
    trpc.createStudentGroup.mutationOptions(),
  );

  const studentsQuery = useQuery({
    ...trpc.getClassStudents.queryOptions({
      classId: classIdNumber,
    }),
    enabled: Number.isFinite(classIdNumber),
  });

  const progressQuery = useQuery({
    ...trpc.analyzeClassProgress.queryOptions({
      classId: classIdNumber,
    }),
    enabled: Number.isFinite(classIdNumber),
  });

  const classPerformanceTrendsQuery = useQuery({
    ...trpc.getClassPerformanceTrends.queryOptions({
      classId: classIdNumber,
      timeRange,
    }),
    enabled: Number.isFinite(classIdNumber),
  });

  const groupsQuery = useQuery({
    ...trpc.getClassGroups.queryOptions({
      classId: classIdNumber,
    }),
    enabled: Number.isFinite(classIdNumber),
  });

  useEffect(() => {
    if (search.open === "upload") {
      setShowAssignmentUpload(true);
    }
  }, [search.open]);

  const classData = studentsQuery.data?.class;
  const students = studentsQuery.data?.students || [];
  const groups = groupsQuery.data?.groups || [];
  const progressData = progressQuery.data as
    | { aiAnalysis?: { progressPercentage?: number | null } }
    | undefined;

  const totalAssignments = students.reduce(
    (sum, student) => sum + student._count.assignments,
    0,
  );
  const totalExams = students.reduce(
    (sum, student) => sum + student._count.exams,
    0,
  );
  const totalMistakes = students.reduce(
    (sum, student) =>
      sum + student._count.mistakes + student._count.examMistakes,
    0,
  );
  const specialAttentionCount = students.filter(
    (student) => student.specialAttention,
  ).length;
  const progressPercentage =
    progressData?.aiAnalysis?.progressPercentage ?? null;

  const classroomHints = useMemo(
    () => [
      {
        title: students.length > 0 ? "保持学生名单更新" : "先补齐班级学生名单",
        description:
          students.length > 0
            ? `当前共 ${students.length} 名学生，后续上传记录会自动沉淀到个人画像。`
            : "添加学生后，作业上传、学生画像和班级分析会逐步完整。",
      },
      {
        title:
          totalAssignments + totalExams > 0
            ? "继续积累学习记录"
            : "建议先上传一批作业",
        description:
          totalAssignments + totalExams > 0
            ? `目前已有 ${totalAssignments + totalExams} 条学习记录，可继续补充近期课堂数据。`
            : "上传首批作业或试卷后，趋势图、学生表现和知识点掌握会更有参考价值。",
      },
      {
        title: specialAttentionCount > 0 ? "关注重点学生" : "保持常规追踪",
        description:
          specialAttentionCount > 0
            ? `当前有 ${specialAttentionCount} 名重点关注学生，适合继续跟进其错题与作业波动。`
            : "当前未标记重点关注对象，可以根据后续成绩波动再补充标注。",
      },
    ],
    [specialAttentionCount, students.length, totalAssignments, totalExams],
  );

  const closeAssignmentUpload = () => {
    setShowAssignmentUpload(false);
    if (search.open === "upload") {
      void navigate({
        to: "/classes/$classId",
        params: { classId },
        search: {},
        replace: true,
      });
    }
  };

  const handleRefreshInvitationCode = async () => {
    try {
      await refreshInvitationCodeMutation.mutateAsync({
        classId: classIdNumber,
      });
      toast.success("邀请码已刷新");
      void studentsQuery.refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStudentClick = (studentId: number) => {
    void navigate({
      to: "/classes/$classId/students/$studentId",
      params: { classId, studentId: studentId.toString() },
    });
  };

  const handleDeleteStudent = (student: ClassStudentRecord) => {
    setSelectedStudent(student);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteStudent = async () => {
    if (!selectedStudent) return;
    try {
      const result = (await deleteStudentMutation.mutateAsync({
        studentId: selectedStudent.id,
      })) as { success: boolean };
      if (result.success) {
        toast.success(`已删除学生 ${selectedStudent.name}`);
        setShowDeleteConfirm(false);
        setSelectedStudent(null);
        void studentsQuery.refetch();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSpecialAttention = async (student: ClassStudentRecord) => {
    try {
      const result = (await toggleSpecialAttentionMutation.mutateAsync({
        studentId: student.id,
      })) as { success: boolean; action: "added" | "removed" };
      if (result.success) {
        const actionText = result.action === "added" ? "加入" : "取消";
        toast.success(`已${actionText}重点关注：${student.name}`);
        void studentsQuery.refetch();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAddToGroup = (student: ClassStudentRecord) => {
    setSelectedStudentForGroup(student);
    setShowGroupModal(true);
  };

  const handleAssignToGroup = async (
    studentId: number,
    groupId: number | null,
  ) => {
    try {
      const result = (await assignStudentToGroupMutation.mutateAsync({
        studentId,
        groupId,
      })) as {
        success: boolean;
        action: "assigned" | "removed";
        student: {
          name: string;
          groupName?: string | null;
        };
      };
      if (result.success) {
        const actionText =
          result.action === "assigned" ? "分配到小组" : "移出小组";
        toast.success(
          `学生 ${result.student.name} 已${actionText}${result.student.groupName ? `：${result.student.groupName}` : ""}`,
        );
        await Promise.all([studentsQuery.refetch(), groupsQuery.refetch()]);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCreateGroup = async (
    name: string,
    description?: string,
    color: string = "blue",
  ) => {
    try {
      const result = (await createStudentGroupMutation.mutateAsync({
        classId: classIdNumber,
        name,
        description,
        color,
      })) as { success: boolean; group: { name: string } };
      if (result.success) {
        toast.success(`已创建小组 ${result.group.name}`);
        await groupsQuery.refetch();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  if (!teacher) {
    return null;
  }

  return (
    <>
      <DashboardShell
        activeNav="classes"
        title={classData?.name || "班级详情"}
        subtitle={
          classData?.description ||
          `共 ${students.length} 名学生，累计 ${totalAssignments} 份作业与 ${totalExams} 份试卷。`
        }
        selectedClassIdOverride={classIdNumber}
        onSelectedClassChange={(nextClassId) => {
          void navigate({
            to: "/classes/$classId",
            params: { classId: nextClassId.toString() },
          });
        }}
        showDateRangeBadge={false}
        actions={() => (
          <>
            <ModuleButton
              icon={Upload}
              onClick={() => setShowAssignmentUpload(true)}
            >
              上传作业
            </ModuleButton>
            <ModuleButton
              icon={UserPlus}
              tone="primary"
              onClick={() => setShowAddStudentModal(true)}
            >
              添加学生
            </ModuleButton>
            <ModuleButton
              icon={BarChart3}
              onClick={() => setShowReportModal(true)}
            >
              生成报告
            </ModuleButton>
            <ModuleButton
              icon={Users}
              onClick={() => setShowInvitationCode((value) => !value)}
            >
              邀请码
            </ModuleButton>
            <ModuleButton
              icon={BookOpen}
              onClick={() => setShowTeachingMaterials(true)}
            >
              资料库
            </ModuleButton>
            <ModuleButton
              icon={Brain}
              onClick={() => setShowQuestionGenerator(true)}
            >
              题目生成
            </ModuleButton>
          </>
        )}
      >
        {() => {
          if (studentsQuery.isLoading && !classData) {
            return (
              <div className="space-y-6">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white"
                  />
                ))}
              </div>
            );
          }

          if (!classData) {
            return (
              <EmptyState
                icon={BookOpen}
                title="未找到班级"
                description="当前班级不存在，或者你没有访问这个班级的权限。"
              />
            );
          }

          return (
            <>
              <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="学生人数"
                  value={`${students.length}`}
                  caption={classData.name}
                  trend={
                    specialAttentionCount > 0
                      ? `${specialAttentionCount} 人关注`
                      : "持续维护"
                  }
                  tone={specialAttentionCount > 0 ? "down" : "up"}
                  icon={Users}
                  iconClassName="bg-blue-500"
                />
                <MetricCard
                  title="作业记录"
                  value={`${totalAssignments}`}
                  caption="已归档作业"
                  trend={totalAssignments > 0 ? "可持续分析" : "等待上传"}
                  tone={totalAssignments > 0 ? "up" : "neutral"}
                  icon={ClipboardCheck}
                  iconClassName="bg-emerald-500"
                />
                <MetricCard
                  title="试卷记录"
                  value={`${totalExams}`}
                  caption="已归档试卷"
                  trend={totalExams > 0 ? "成绩可追踪" : "等待录入"}
                  tone={totalExams > 0 ? "up" : "neutral"}
                  icon={Award}
                  iconClassName="bg-violet-500"
                />
                <MetricCard
                  title="错题总量"
                  value={`${totalMistakes}`}
                  caption="作业与试卷累计"
                  trend={
                    progressPercentage === null
                      ? "等待分析"
                      : `AI进度 ${progressPercentage}%`
                  }
                  tone={totalMistakes > 0 ? "down" : "neutral"}
                  icon={FileText}
                  iconClassName="bg-orange-500"
                />
              </section>

              {showInvitationCode ? (
                <section className="mb-6">
                  <InvitationCodeSection
                    classData={classData}
                    isRefreshing={refreshInvitationCodeMutation.isPending}
                    onRefresh={() => {
                      void handleRefreshInvitationCode();
                    }}
                  />
                </section>
              ) : null}

              <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <div className="mb-4 flex justify-end">
                    <TimeRangeSelector
                      value={timeRange}
                      onChange={setTimeRange}
                    />
                  </div>
                  <ClassPerformanceChart
                    data={{
                      performanceTrends:
                        classPerformanceTrendsQuery.data?.performanceTrends ||
                        [],
                      participationTrends:
                        classPerformanceTrendsQuery.data?.participationTrends ||
                        [],
                      mistakeTrends:
                        classPerformanceTrendsQuery.data?.mistakeTrends || [],
                    }}
                  />
                </div>

                <div className="space-y-6 xl:col-span-4">
                  <Panel title="班级概览" subtitle="当前班级的基础信息与状态">
                    <div className="space-y-4 text-sm">
                      <DetailRow label="教师" value={teacher.name} />
                      <DetailRow
                        label="创建时间"
                        value={new Date(classData.createdAt).toLocaleDateString(
                          "zh-CN",
                        )}
                      />
                      <DetailRow
                        label="班级描述"
                        value={classData.description || "暂无描述"}
                      />
                      <DetailRow label="小组数量" value={`${groups.length}`} />
                      <DetailRow
                        label="AI分析进度"
                        value={
                          progressPercentage === null
                            ? "等待分析"
                            : `${progressPercentage}%`
                        }
                      />

                      <button
                        onClick={() => setShowArchiveModal(true)}
                        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        归档班级
                      </button>
                    </div>
                  </Panel>

                  <Panel
                    title="当前建议"
                    subtitle="围绕班级管理和近期数据的行动提醒"
                  >
                    <div className="space-y-3">
                      {classroomHints.map((hint) => (
                        <div
                          key={hint.title}
                          className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {hint.title}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {hint.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </section>

              <ClassStudents
                students={students}
                onStudentClick={handleStudentClick}
                onDeleteStudent={handleDeleteStudent}
                onSpecialAttention={(student) => {
                  void handleSpecialAttention(student);
                }}
                onAddToGroup={handleAddToGroup}
                onShowAddStudentModal={() => setShowAddStudentModal(true)}
              />
            </>
          );
        }}
      </DashboardShell>

      <AddStudentModal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        classId={classIdNumber}
        onSuccess={() => {
          void studentsQuery.refetch();
          toast.success("学生添加成功");
        }}
      />

      <ReportGenerationModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        classId={classIdNumber}
        className={classData?.name || ""}
      />

      <ArchiveClassModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        classId={classIdNumber}
        className={classData?.name || ""}
        onSuccess={() => {
          setShowArchiveModal(false);
          void navigate({ to: "/dashboard/classes" });
        }}
      />

      <EnhancedTeacherAssignmentUpload
        isOpen={showAssignmentUpload}
        onClose={closeAssignmentUpload}
        classId={classIdNumber}
        students={students.map((student) => ({
          id: student.id,
          name: student.name,
        }))}
        onSuccess={(uploadedCount) => {
          toast.success(`已归档 ${uploadedCount} 份，AI 批改结果稍后可在学生档案中查看`);
          closeAssignmentUpload();
          void studentsQuery.refetch();
        }}
      />

      <ModalWrapper
        isOpen={showTeachingMaterials}
        onClose={() => setShowTeachingMaterials(false)}
        maxWidth="max-w-6xl"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8 text-slate-500">
              加载中...
            </div>
          }
        >
          <TeachingMaterialLibrary
            onClose={() => setShowTeachingMaterials(false)}
          />
        </Suspense>
      </ModalWrapper>

      <ModalWrapper
        isOpen={showQuestionGenerator}
        onClose={() => setShowQuestionGenerator(false)}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8 text-slate-500">
              加载中...
            </div>
          }
        >
          <TargetedQuestionGenerator
            classId={classIdNumber}
            onClose={() => setShowQuestionGenerator(false)}
          />
        </Suspense>
      </ModalWrapper>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="确认删除学生"
        message={
          <>
            您确定要删除学生{" "}
            <span className="font-semibold text-slate-900">
              {selectedStudent?.name}
            </span>{" "}
            吗？
            <p className="mt-2 text-sm text-red-600">
              此操作会永久删除该学生的作业、试卷和错题记录，无法恢复。
            </p>
          </>
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        destructive
        isLoading={deleteStudentMutation.isPending}
        onConfirm={() => {
          void confirmDeleteStudent();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {selectedStudentForGroup ? (
        <GroupSelectionModal
          isOpen={showGroupModal}
          onClose={() => {
            setShowGroupModal(false);
            setSelectedStudentForGroup(null);
          }}
          student={selectedStudentForGroup}
          groups={groups}
          onAssignToGroup={handleAssignToGroup}
          onCreateGroup={handleCreateGroup}
        />
      ) : null}
    </>
  );
}

function InvitationCodeSection({
  classData,
  isRefreshing,
  onRefresh,
}: {
  classData: Pick<ClassRecord, "invitationCode" | "invitationCodeExpiresAt">;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("邀请码已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制邀请码失败");
    }
  };

  const expiresAt = new Date(classData.invitationCodeExpiresAt);
  const remaining = Math.max(0, expiresAt.getTime() - Date.now());
  const remainingDays = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const remainingHours = Math.ceil(
    (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-950">学生邀请码</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">
                用于邀请学生加入当前班级。
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void copyCode(classData.invitationCode)}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                复制邀请码
              </>
            )}
          </button>
          <button
            onClick={() => {
              void onRefresh();
            }}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isRefreshing ? "刷新中..." : "刷新邀请码"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <InfoCard label="当前邀请码" value={classData.invitationCode} />
        <InfoCard
          label="过期时间"
          value={expiresAt.toLocaleString("zh-CN")}
          icon={<Clock className="h-4 w-4 text-slate-400" />}
        />
        <InfoCard
          label="剩余时长"
          value={
            remainingDays > 0
              ? `${remainingDays} 天 ${remainingHours} 小时`
              : `${remainingHours} 小时`
          }
        />
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-base font-bold text-slate-950">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}
