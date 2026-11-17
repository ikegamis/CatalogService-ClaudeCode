import { UseCaseResult } from "Application/Shared/UseCaseResult";

/**
 * Controller が依存するユースケースの形。Application のサービスクラスはこの形を満たす。
 * 具象クラスではなくこの形に依存させ、HTTP 境界のテストでユースケースをテストダブルに置き換えられるようにする。
 */
export type UseCase<TInput, TOutput> = {
  execute(input: TInput): Promise<UseCaseResult<TOutput>>;
};
