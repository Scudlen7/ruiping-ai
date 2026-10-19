import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import {
  AlertTriangle, Search, Filter, ChevronLeft, ChevronRight,
  BookOpen, User, Tag, Loader2, FileText, Award
} from "lucide-react";

interface MistakeLibraryProps {
  onClose: () => void;
}

export function MistakeLibrary({ onClose }: MistakeLibraryProps) {
  const trpc = useTRPC();
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedKnowledgeAreaId, setSelectedKnowledgeAreaId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const classesQuery = useQuery({
    ...trpc.getTeacherClasses.queryOptions(),
  });

  const knowledgeAreasQuery = useQuery({
    ...trpc.getKnowledgeAreas.queryOptions(),
  });

  const studentsQuery = useQuery({
    ...trpc.getClassStudents.queryOptions({
      classId: selectedClassId!,
    }),
    enabled: !!selectedClassId,
  });

  const mistakesQuery = useQuery({
    ...trpc.getMistakeLibrary.queryOptions({
      classId: selectedClassId!,
      knowledgeAreaId: selectedKnowledgeAreaId || undefined,
      studentId: selectedStudentId || undefined,
      page,
      pageSize: 15,
    }),
    enabled: !!selectedClassId,
  });

  const classes = classesQuery.data?.classes || [];
  const knowledgeAreas = knowledgeAreasQuery.data?.knowledgeAreas || [];
  const students = studentsQuery.data?.students || [];
  const mistakesData = mistakesQuery.data;

  const resetFilters = () => {
    setSelectedKnowledgeAreaId(null);
    setSelectedStudentId(null);
    setPage(1);
    setSearchQuery("");
  };

  const filteredStudents = searchQuery
    ? students.filter(s => s.name.includes(searchQuery))
    : students;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center mr-3">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">错题库</h2>
            <p className="text-sm text-gray-500">查看和管理学生错题</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">选择班级</label>
          <select
            value={selectedClassId || ""}
            onChange={(e) => {
              setSelectedClassId(e.target.value ? Number(e.target.value) : null);
              resetFilters();
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
          >
            <option value="">请选择班级</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">知识点筛选</label>
          <select
            value={selectedKnowledgeAreaId || ""}
            onChange={(e) => {
              setSelectedKnowledgeAreaId(e.target.value ? Number(e.target.value) : null);
              setPage(1);
            }}
            disabled={!selectedClassId}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">全部知识点</option>
            {knowledgeAreas.map((ka) => (
              <option key={ka.id} value={ka.id}>{ka.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学生筛选</label>
          <div className="relative">
            <input
              type="text"
              placeholder={selectedClassId ? "搜索学生姓名..." : "请先选择班级"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!selectedClassId}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          {searchQuery && filteredStudents.length > 0 && (
            <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredStudents.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStudentId(s.id);
                    setPage(1);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {selectedStudentId && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                {students.find(s => s.id === selectedStudentId)?.name}
                <button onClick={() => { setSelectedStudentId(null); setPage(1); }} className="ml-1 text-red-400 hover:text-red-600">&times;</button>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            onClick={resetFilters}
            disabled={!selectedClassId && !selectedKnowledgeAreaId && !selectedStudentId}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Filter className="w-4 h-4 inline mr-1" />
            重置筛选
          </button>
        </div>
      </div>

      {!selectedClassId ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请选择一个班级查看错题库</p>
        </div>
      ) : mistakesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin mr-3" />
          <span className="text-gray-500">加载中...</span>
        </div>
      ) : mistakesData ? (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{mistakesData.stats.totalMistakes}</p>
              <p className="text-xs text-gray-500">错题总数</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">错题最多的学生</p>
              {mistakesData.stats.byStudent.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{s.name}</span>
                  <span className="text-orange-600 font-medium">{s.count}题</span>
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">高频错题知识点</p>
              {mistakesData.stats.byKnowledgeArea.slice(0, 3).map((ka, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{ka.name}</span>
                  <span className="text-purple-600 font-medium">{ka.count}题</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mistake List */}
          <div className="space-y-3">
            {mistakesData.mistakes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>暂无错题记录</p>
              </div>
            ) : (
              mistakesData.mistakes.map((mistake, i) => (
                <div
                  key={`${mistake.source}-${mistake.id}`}
                  className="card p-4 hover:shadow-md transition-shadow border-l-4 border-l-red-400"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          mistake.source === "exam"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {mistake.source === "exam" ? (
                            <><Award className="w-3 h-3 inline mr-1" />考试</>
                          ) : (
                            <><FileText className="w-3 h-3 inline mr-1" />作业</>
                          )}
                        </span>
                        {mistake.knowledgeArea && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            <Tag className="w-3 h-3 inline mr-1" />
                            {mistake.knowledgeArea.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium mb-1">
                        {mistake.description}
                      </p>
                      {mistake.originalQuestionText && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-2">
                          {mistake.originalQuestionText.length > 100
                            ? mistake.originalQuestionText.slice(0, 100) + "..."
                            : mistake.originalQuestionText}
                        </p>
                      )}
                      {mistake.correctAnswer && (
                        <p className="text-xs text-green-600">
                          正确答案：{mistake.correctAnswer}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                        <User className="w-3 h-3" />
                        {mistake.student?.name ?? "未知学生"}
                      </div>
                      {mistake.sourceTitle && (
                        <p className="text-xs text-gray-400">{mistake.sourceTitle}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(mistake.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {mistakesData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                共 {mistakesData.total} 条，第 {mistakesData.page}/{mistakesData.totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, mistakesData.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        page === pageNum
                          ? "bg-red-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(mistakesData.totalPages, p + 1))}
                  disabled={page === mistakesData.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">暂无数据</div>
      )}
    </div>
  );
}
