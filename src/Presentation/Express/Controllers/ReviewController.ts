import { Request, Response } from "express";

import { DeleteReviewCommand, DeleteReviewDto } from "Application/Services/Review/DeleteReviewService";
import { RegisterReviewCommand } from "Application/Services/Review/RegisterReviewService";
import { ReviewDto } from "Application/Services/Review/ReviewDto";
import { UpdateReviewCommand } from "Application/Services/Review/UpdateReviewService";
import { toReviewResponse, unwrap } from "Presentation/Express/Mappers/ResponseMapper";
import {
  JsonObject,
  optionalNullableString,
  requireJsonObject,
  requireNumber,
  requireString,
} from "Presentation/Express/Validation/RequestValidator";

import { UseCase } from "./UseCase";

/** openapi.yml の components/schemas/ReviewRequest（登録・更新で共通）。 */
const parseReviewRequest = (body: JsonObject) => ({
  bookId: requireString(body, "bookId"),
  name: optionalNullableString(body, "name"),
  rating: requireNumber(body, "rating"),
  comment: optionalNullableString(body, "comment"),
});

export class ReviewController {
  constructor(
    private readonly registerReview: UseCase<RegisterReviewCommand, ReviewDto>,
    private readonly updateReview: UseCase<UpdateReviewCommand, ReviewDto>,
    private readonly deleteReview: UseCase<DeleteReviewCommand, DeleteReviewDto>,
  ) {}

  /** POST /review（UC-REVIEW-001 レビューの登録）。 */
  readonly create = async (req: Request, res: Response): Promise<void> => {
    const command: RegisterReviewCommand = parseReviewRequest(requireJsonObject(req.body));
    const review = unwrap(await this.registerReview.execute(command));
    res.status(201).json({ ok: true, review: toReviewResponse(review) });
  };

  /**
   * PUT /review/{id}（UC-REVIEW-002 レビューの更新）。
   * レビューIDはパスからのみ受け取り、ボディに id があっても使わない（レビューID以外を更新する）。
   */
  readonly update = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const command: UpdateReviewCommand = {
      reviewId: req.params.id,
      ...parseReviewRequest(requireJsonObject(req.body)),
    };
    const review = unwrap(await this.updateReview.execute(command));
    res.status(200).json({ ok: true, review: toReviewResponse(review) });
  };

  /** DELETE /review/{id}（UC-CATALOG-003 レビューの削除）。 */
  readonly delete = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const result = unwrap(await this.deleteReview.execute({ reviewId: req.params.id }));
    res.status(200).json({ ok: true, message: `'${result.reviewId}' は削除されました` });
  };
}
