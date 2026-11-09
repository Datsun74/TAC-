import "server-only";

import { getTaskUserContext } from "@/lib/task-access";
import { createClient } from "@/lib/supabase/server";
import type { TaskHoshinNode, TaskHoshinNodeLevel, TaskHoshinPlan } from "@/types/task";

type HoshinPlanRow = {
  task_id: string;
  action: string;
  metric_name: string;
  metric_target: string;
  owner_name: string;
  executor_comment: string;
  proposed_metric: string;
  proposal_author_name: string | null;
  proposal_updated_at: string | null;
  updated_at: string;
};

type HoshinNodeRow = HoshinPlanRow & {
  id: string;
  parent_id: string | null;
  level: string;
  title: string;
  created_at: string;
};

function isHoshinNodeLevel(value: string): value is TaskHoshinNodeLevel {
  return value === "division" || value === "department";
}

function mapPlan(row: HoshinPlanRow): TaskHoshinPlan {
  return {
    taskId: row.task_id,
    action: row.action,
    metricName: row.metric_name,
    metricTarget: row.metric_target,
    ownerName: row.owner_name,
    executorComment: row.executor_comment,
    proposedMetric: row.proposed_metric,
    proposalAuthorName: row.proposal_author_name,
    proposalUpdatedAt: row.proposal_updated_at,
    updatedAt: row.updated_at,
  };
}

function mapNode(row: HoshinNodeRow): TaskHoshinNode | null {
  if (!isHoshinNodeLevel(row.level)) return null;

  return {
    id: row.id,
    taskId: row.task_id,
    parentId: row.parent_id,
    level: row.level,
    title: row.title,
    action: row.action,
    metricName: row.metric_name,
    metricTarget: row.metric_target,
    ownerName: row.owner_name,
    executorComment: row.executor_comment,
    proposedMetric: row.proposed_metric,
    proposalAuthorName: row.proposal_author_name,
    proposalUpdatedAt: row.proposal_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getHoshinKanriData(): Promise<Readonly<{
  plans: readonly TaskHoshinPlan[];
  nodes: readonly TaskHoshinNode[];
  setupError: string | null;
}>> {
  await getTaskUserContext();
  const supabase = await createClient();
  const fields = "task_id, action, metric_name, metric_target, owner_name, executor_comment, proposed_metric, proposal_author_name, proposal_updated_at, updated_at";
  const [plansResult, nodesResult] = await Promise.all([
    supabase.from("task_hoshin_plans").select(fields).order("updated_at", { ascending: false }),
    supabase.from("task_hoshin_nodes").select(`id, parent_id, level, title, created_at, ${fields}`).order("created_at"),
  ]);

  if (plansResult.error || nodesResult.error) {
    return {
      plans: [],
      nodes: [],
      setupError: "Щоб відкрити Хошин Канрі, виконайте файл supabase/task-hoshin-kanri.sql у Supabase SQL Editor.",
    };
  }

  return {
    plans: (plansResult.data ?? []).map((row) => mapPlan(row as HoshinPlanRow)),
    nodes: (nodesResult.data ?? []).map((row) => mapNode(row as HoshinNodeRow)).filter((node): node is TaskHoshinNode => node !== null),
    setupError: null,
  };
}
