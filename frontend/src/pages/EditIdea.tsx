import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Edit2, Loader2 } from "lucide-react";
import { useIdea } from "../hooks/useIdeas";
import IdeaForm from "../components/IdeaForm";
import type { LifecycleStage, IdeaType } from "../types";

export default function EditIdea() {
  const { slug } = useParams<{ slug: string }>();
  const { idea, loading, error } = useIdea(slug);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          to="/ideas"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to ideas
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error?.message || "Idea not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to={`/ideas/${slug}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to idea
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Edit2 className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Idea</h1>
            <p className="text-sm text-gray-500">{idea.title}</p>
          </div>
        </div>

        <IdeaForm
          mode="edit"
          slug={slug}
          initialData={{
            title: idea.title,
            summary: idea.summary,
            idea_type: idea.idea_type as IdeaType,
            lifecycle_stage: idea.lifecycle_stage as LifecycleStage,
            content: idea.content,
            tags: idea.tags || [],
          }}
        />
      </div>
    </div>
  );
}
