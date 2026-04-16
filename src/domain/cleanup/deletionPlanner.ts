import {
  PhotoCluster,
  DeletionPlan,
  ClusterDeletionPlan,
  PlanStatus,
  UserClusterDecision,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

export class DeletionPlanner {
  buildPlan(clusters: PhotoCluster[]): DeletionPlan {
    const clusterPlans: ClusterDeletionPlan[] = [];
    let totalPhotosToDelete = 0;
    let totalSpaceEstimate = 0;

    for (const cluster of clusters) {
      if (cluster.status !== 'actionable' || !cluster.recommendation) {
        continue;
      }

      const plan: ClusterDeletionPlan = {
        clusterId: cluster.id,
        keepPhotoId: cluster.recommendation.keepPhotoId,
        deletePhotoIds: [...cluster.recommendation.deletePhotoIds],
        confirmed: false,
      };

      clusterPlans.push(plan);
      totalPhotosToDelete += plan.deletePhotoIds.length;

      // Estimate space savings from metadata
      for (const photo of cluster.photos) {
        if (plan.deletePhotoIds.includes(photo.asset.id)) {
          totalSpaceEstimate += photo.metadata.fileSize ?? 0;
        }
      }
    }

    return {
      id: uuidv4(),
      clusters: clusterPlans,
      totalPhotosToDelete,
      totalSpaceEstimateBytes: totalSpaceEstimate,
      status: 'draft',
    };
  }

  // Apply user override decisions to the plan
  applyUserDecisions(plan: DeletionPlan, decisions: Map<string, UserClusterDecision>): DeletionPlan {
    const updatedClusters = plan.clusters.map((clusterPlan) => {
      const decision = decisions.get(clusterPlan.clusterId);
      if (!decision) return clusterPlan;

      return {
        ...clusterPlan,
        keepPhotoId: decision.keepPhotoId,
        deletePhotoIds: decision.deletePhotoIds,
      };
    });

    const totalPhotosToDelete = updatedClusters.reduce(
      (sum, c) => sum + c.deletePhotoIds.length,
      0
    );

    return {
      ...plan,
      clusters: updatedClusters,
      totalPhotosToDelete,
      status: plan.status === 'draft' ? 'reviewing' : plan.status,
    };
  }

  confirmCluster(plan: DeletionPlan, clusterId: string): DeletionPlan {
    const updatedClusters = plan.clusters.map((c) =>
      c.clusterId === clusterId ? { ...c, confirmed: true } : c
    );

    const allConfirmed = updatedClusters.every((c) => c.confirmed);

    return {
      ...plan,
      clusters: updatedClusters,
      status: allConfirmed ? 'confirmed' : 'reviewing',
    };
  }

  unconfirmCluster(plan: DeletionPlan, clusterId: string): DeletionPlan {
    const updatedClusters = plan.clusters.map((c) =>
      c.clusterId === clusterId ? { ...c, confirmed: false } : c
    );

    return {
      ...plan,
      clusters: updatedClusters,
      status: 'reviewing',
    };
  }

  getConfirmedClusters(plan: DeletionPlan): ClusterDeletionPlan[] {
    return plan.clusters.filter((c) => c.confirmed);
  }

  getUnconfirmedClusters(plan: DeletionPlan): ClusterDeletionPlan[] {
    return plan.clusters.filter((c) => !c.confirmed);
  }
}
