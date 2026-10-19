import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, BookOpen, ClipboardCheck, Target, UserPlus, Users } from "lucide-react";
import { AddStudentModal } from "~/components/AddStudentModal";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { GroupSelectionModal } from "~/components/GroupSelectionModal";
import { ClassStudents, type ClassStudentRecord } from "~/components/class/ClassStudents";
import { useToast } from "~/components/Toast";
import { useTRPC } from "~/trpc/react";
import { getErrorMessage } from "~/utils/trpcError";
import { ActionList, CompactStat, EmptyState, Panel } from "../ui";
import type { DashboardPageContext } from "../types";

type StudentDialog = { kind: "delete" | "group"; student: ClassStudentRecord } | null;

export function StudentManagement({ ctx }: { ctx: DashboardPageContext }) {
  const trpc = useTRPC();
  const toast = useToast();
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [dialog, setDialog] = useState<StudentDialog>(null);

  const studentsQuery = useQuery({
    ...trpc.getClassStudents.queryOptions({ classId: ctx.selectedClassId }),
    enabled: !!ctx.selectedClassId,
  });
  const groupsQuery = useQuery({
    ...trpc.getClassGroups.queryOptions({ classId: ctx.selectedClassId }),
    enabled: !!ctx.selectedClassId,
  });

  const deleteStudentMutation = useMutation(trpc.deleteStudentFromClass.mutationOptions());
  const toggleSpecialAttentionMutation = useMutation(trpc.toggleSpecialAttention.mutationOptions());
  const assignStudentToGroupMutation = useMutation(trpc.assignStudentToGroup.mutationOptions());
  const createStudentGroupMutation = useMutation(trpc.createStudentGroup.mutationOptions());

  const students = studentsQuery.data?.students || [];
  const groups = groupsQuery.data?.groups || [];
  const refetchRoster = () => Promise.all([studentsQuery.refetch(), groupsQuery.refetch()]);

  const confirmDeleteStudent = async (student: ClassStudentRecord) => {
    try {
      await deleteStudentMutation.mutateAsync({ studentId: student.id });
      toast.success(`已删除学生 ${student.name}`);
      setDialog(null);
      void refetchRoster();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSpecialAttention = async (student: ClassStudentRecord) => {
    try {
      const result = await toggleSpecialAttentionMutation.mutateAsync({ studentId: student.id });
      toast.success(`已${result.action === "added" ? "加入" : "取消"}重点关注：${student.name}`);
      void studentsQuery.refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAssignToGroup = async (studentId: number, groupId: number | null) => {
    try {
      const result = await assignStudentToGroupMutation.mutateAsync({ studentId, groupId });
      const actionText = result.action === "assigned" ? "分配到小组" : "移出小组";
      toast.success(
        `学生 ${result.student.name} 已${actionText}${result.student.groupName ? `：${result.student.groupName}` : ""}`,
      );
      await refetchRoster();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  const handleCreateGroup = async (name: string, description?: string, color: string = "blue") => {
    try {
      const result = await createStudentGroupMutation.mutateAsync({
        classId: ctx.selectedClassId,
        name,
        description,
        color,
      });
      toast.success(`已创建小组 ${result.group.name}`);
      await groupsQuery.refetch();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  if (studentsQuery.isLoading) {
    return <EmptyState icon={Users} title="学生数据加载中" description=" " />;
  }

  const focusedCount = students.filter((student) => student.specialAttention).length;
  const groupedCount = students.filter((student) => student.group).length;
  const totalRecords = students.reduce(
    (sum, student) => sum + student._count.assignments + student._count.exams,
    0,
  );

  return (
    <>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <ClassStudents
            students={students}
            onStudentClick={ctx.openSelectedStudent}
            onDeleteStudent={(student) => setDialog({ kind: "delete", student })}
            onSpecialAttention={(student) => void handleSpecialAttention(student)}
            onAddToGroup={(student) => setDialog({ kind: "group", student })}
            onShowAddStudentModal={() => setShowAddStudentModal(true)}
          />
        </div>

        <div className="space-y-6 xl:col-span-4">
          <Panel
            title="管理概览"
            subtitle={ctx.selectedClass ? `${ctx.selectedClass.name} 当前学生状态` : "暂无班级"}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <CompactStat label="学生总数" value={`${students.length}`} icon={Users} />
              <CompactStat label="已分组" value={`${groupedCount}`} icon={BookOpen} />
              <CompactStat label="重点关注" value={`${focusedCount}`} icon={Target} />
              <CompactStat label="学习记录" value={`${totalRecords}`} icon={ClipboardCheck} />
            </div>
          </Panel>

          <Panel title="本页可直接完成" subtitle="不用再跳到班级详情才能管理学生">
            <ActionList
              items={[
                {
                  icon: UserPlus,
                  title: "添加或批量导入学生",
                  text: "直接在当前页面补充名单，支持单个添加和批量导入。",
                  onClick: () => setShowAddStudentModal(true),
                },
                {
                  icon: BookOpen,
                  title: "进入班级工作台",
                  text:
                    groups.length > 0
                      ? `当前已建立 ${groups.length} 个小组，班级页里还能继续处理上传和邀请码。`
                      : "需要处理上传、邀请码或班级级别动作时，可以进入班级工作台。",
                  onClick: ctx.openSelectedClass,
                },
                {
                  icon: BarChart3,
                  title: "查看班级学情",
                  text: "学生名单、关注对象和成绩趋势现在可以联动查看。",
                  onClick: ctx.openDataAnalysis,
                },
              ]}
            />
          </Panel>
        </div>
      </section>

      {ctx.selectedClass ? (
        <AddStudentModal
          isOpen={showAddStudentModal}
          onClose={() => setShowAddStudentModal(false)}
          classId={ctx.selectedClass.id}
          onSuccess={() => {
            void refetchRoster();
            toast.success("学生添加成功");
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        title="确认删除学生"
        message={
          <>
            您确定要删除学生{" "}
            <span className="font-semibold text-slate-900">{dialog?.student.name}</span> 吗？
            <p className="mt-2 text-sm text-red-600">此操作会永久删除该学生的作业、试卷和错题记录，无法恢复。</p>
          </>
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        destructive
        isLoading={deleteStudentMutation.isPending}
        onConfirm={() => {
          if (dialog) void confirmDeleteStudent(dialog.student);
        }}
        onCancel={() => setDialog(null)}
      />

      {dialog?.kind === "group" ? (
        <GroupSelectionModal
          isOpen
          onClose={() => setDialog(null)}
          student={dialog.student}
          groups={groups}
          onAssignToGroup={handleAssignToGroup}
          onCreateGroup={handleCreateGroup}
        />
      ) : null}
    </>
  );
}
