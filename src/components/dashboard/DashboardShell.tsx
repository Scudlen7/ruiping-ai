import { type ReactNode, useState, lazy, Suspense } from "react";
import { RequireAuth } from "~/components/RequireAuth";
import { DashboardSkeleton } from "~/components/DashboardSkeleton";
import { ModalWrapper } from "~/components/ModalWrapper";
import { useToast } from "~/components/Toast";
import { useLogout } from "~/components/auth/useLogout";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { useDashboardContext } from "./useDashboardContext";
import type { DashboardNavKey, DashboardPageContext } from "./types";

const CreateClassModal = lazy(() =>
  import("~/components/CreateClassModal").then((m) => ({
    default: m.CreateClassModal,
  })),
);
const ReviewSchedule = lazy(() =>
  import("~/components/ReviewSchedule").then((m) => ({
    default: m.ReviewSchedule,
  })),
);

type DashboardShellProps = {
  activeNav: DashboardNavKey;
  title: string;
  subtitle?: string | ((ctx: DashboardPageContext) => string);
  actions?: (ctx: DashboardPageContext) => ReactNode;
  children: (ctx: DashboardPageContext) => ReactNode;
  selectedClassIdOverride?: number | null;
  onSelectedClassChange?: (classId: number) => void;
  showDateRangeBadge?: boolean;
  showClassSelector?: boolean;
  showCreateClassButton?: boolean;
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8 text-gray-500">
    加载中...
  </div>
);

function welcomeText(teacherName: string) {
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return `欢迎回来，${teacherName}，今天是 ${today}`;
}

export function DashboardShell({
  activeNav,
  title,
  subtitle,
  actions,
  children,
  selectedClassIdOverride,
  onSelectedClassChange,
  showDateRangeBadge = true,
  showClassSelector = true,
  showCreateClassButton = true,
}: DashboardShellProps) {
  const logout = useLogout();
  const toast = useToast();
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [showReviewSchedule, setShowReviewSchedule] = useState(false);
  const { ctx, isLoading } = useDashboardContext({
    selectedClassIdOverride,
    openCreateClass: () => setIsCreateClassModalOpen(true),
    openReviewSchedule: () => setShowReviewSchedule(true),
  });

  if (!ctx) {
    return <RequireAuth role="teacher">{isLoading ? <DashboardSkeleton /> : null}</RequireAuth>;
  }

  const handleLogout = async () => {
    await logout();
    toast.success("已成功退出登录");
  };

  const handleHeaderClassChange = (classId: number) => {
    ctx.setSelectedClassId(classId);
    onSelectedClassChange?.(classId);
  };

  const resolvedSubtitle = (typeof subtitle === "function" ? subtitle(ctx) : subtitle) || welcomeText(ctx.teacher.name);

  return (
    <RequireAuth role="teacher">
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
        <DashboardSidebar activeNav={activeNav} />

        <div className="lg:pl-64">
          <DashboardHeader
            title={title}
            subtitle={resolvedSubtitle}
            classes={ctx.classes}
            selectedClass={ctx.selectedClass}
            timeRange={ctx.timeRange}
            showClassSelector={showClassSelector}
            showDateRangeBadge={showDateRangeBadge}
            showCreateClassButton={showCreateClassButton}
            onClassChange={handleHeaderClassChange}
            onCreateClass={() => setIsCreateClassModalOpen(true)}
            onLogout={() => void handleLogout()}
          />

          <main className="px-4 py-6 sm:px-6 xl:px-8">
            {actions ? (
              <section className="mb-6 flex flex-wrap gap-2">
                {actions(ctx)}
              </section>
            ) : null}
            {children(ctx)}
          </main>
        </div>

        <Suspense fallback={<LoadingSpinner />}>
          <CreateClassModal
            isOpen={isCreateClassModalOpen}
            onClose={() => setIsCreateClassModalOpen(false)}
          />
        </Suspense>

        <ModalWrapper
          isOpen={showReviewSchedule}
          onClose={() => setShowReviewSchedule(false)}
          maxWidth="max-w-4xl"
        >
          <Suspense fallback={<LoadingSpinner />}>
            <ReviewSchedule onClose={() => setShowReviewSchedule(false)} />
          </Suspense>
        </ModalWrapper>
      </div>
    </RequireAuth>
  );
}
