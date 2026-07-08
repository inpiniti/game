// SM-2 로직은 shared/lib/sm2 로 승격됨(출제 엔진과 단일 소스 공유). 여기서는 재노출만 한다.
export { applySm2Grade, DEFAULT_SM2_CARD } from '../../../shared/lib/sm2'
export type { Sm2Card } from '../../../shared/lib/sm2'
