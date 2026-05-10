/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { i128, Option, u32, u64 } from '@stellar/stellar-sdk/contract';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  Spec as ContractSpec,
  MethodOptions,
  Result,
} from '@stellar/stellar-sdk/contract';
import { Buffer } from 'buffer';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

export const Errors = {
  1: { message: 'NotAdmin' },
  2: { message: 'AdminCannotBeZero' },
  3: { message: 'FeeAccountCannotBeZero' },
  4: { message: 'SameFeeAccount' },
  5: { message: 'OnlyOwner' },
  6: { message: 'Unauthorized' },
  7: { message: 'BountyNotFound' },
  8: { message: 'InactiveBounty' },
  9: { message: 'BountyDeadlinePassed' },
  10: { message: 'JudgingDeadlinePassed' },
  11: { message: 'BountyHasSubmissions' },
  12: { message: 'CannotSelectWinnersBeforeSubmissionDeadline' },
  13: { message: 'JudgingDeadlineMustBeAfterSubmissionDeadline' },
  14: { message: 'NotEnoughWinners' },
  15: { message: 'DistributionMustSumTo100' },
  16: { message: 'InvalidDeadlineUpdate' },
  17: { message: 'SubmissionNotFound' },
  18: { message: 'ProjectNotFound' },
  19: { message: 'InvalidProjectType' },
  20: { message: 'ProjectNotActive' },
  21: { message: 'InvalidMilestones' },
  22: { message: 'MilestoneNotFound' },
  23: { message: 'MilestoneAlreadyPaid' },
  24: { message: 'InsufficientEscrow' },
  25: { message: 'InvalidReward' },
  26: { message: 'InvalidAmount' },
  27: { message: 'DeadlinePassed' },
  28: { message: 'InternalError' },
  29: { message: 'HackathonNotFound' },
  30: { message: 'HackathonNotActive' },
  31: { message: 'HackathonDeadlinePassed' },
  32: { message: 'InvalidPrizePool' },
  33: { message: 'HackathonNotCompleted' },
  34: { message: 'InvalidPosition' },
  35: { message: 'AllPositionsNotFilled' },
};

export interface Bounty {
  applicants: Array<string>;
  distribution: Map<u32, u32>;
  judging_deadline: u64;
  owner: string;
  reward: i128;
  status: Status;
  submission_deadline: u64;
  submissions: Map<string, string>;
  title: string;
  token: string;
  winners: Array<string>;
}

export type Status =
  | { tag: 'Active'; values: void }
  | { tag: 'Completed'; values: void }
  | { tag: 'Closed'; values: void };

export interface Project {
  deadline: u64;
  milestones: Array<MilestoneInfo>;
  owner: string;
  project_type: ProjectType;
  remaining_escrow: i128;
  status: ProjectStatus;
  token: string;
  total_reward: i128;
}

export interface Hackathon {
  admin: string;
  deadline: u64;
  prize_pool: Array<HackathonPrize>;
  remaining_escrow: i128;
  status: HackathonStatus;
  token: string;
  total_budget: i128;
  winners: Map<u32, string>;
}

export type ProjectType =
  | { tag: 'Gig'; values: void }
  | { tag: 'Job'; values: void };

export interface MilestoneData {
  amount: i128;
  order: u32;
}

export interface MilestoneInfo {
  amount: i128;
  is_paid: boolean;
  order: u32;
}

export type ProjectStatus =
  | { tag: 'Active'; values: void }
  | { tag: 'Completed'; values: void }
  | { tag: 'Cancelled'; values: void };

export interface HackathonPrize {
  amount: i128;
  position: u32;
}

export type HackathonStatus =
  | { tag: 'Active'; values: void }
  | { tag: 'Completed'; values: void }
  | { tag: 'Cancelled'; values: void };

export interface Client {
  /**
   * Construct and simulate a get_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Bounty>>>;

  /**
   * Construct and simulate a get_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_project: (
    { project_id }: { project_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Project>>>;

  /**
   * Construct and simulate a close_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  close_bounty: (
    { owner, bounty_id }: { owner: string; bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_bounties transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_projects transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_projects: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a update_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_admin: (
    { new_admin }: { new_admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a check_judging transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_judging: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a create_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_bounty: (
    {
      owner,
      token,
      reward,
      distribution,
      submission_deadline,
      judging_deadline,
      title,
    }: {
      owner: string;
      token: string;
      reward: i128;
      distribution: Array<readonly [u32, u32]>;
      submission_deadline: u64;
      judging_deadline: u64;
      title: string;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a delete_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  delete_bounty: (
    { owner, bounty_id }: { owner: string; bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_hackathon transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hackathon: (
    { hackathon_id }: { hackathon_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Hackathon>>>;

  /**
   * Construct and simulate a update_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_bounty: (
    {
      owner,
      bounty_id,
      new_title,
      new_distribution,
      new_submission_deadline,
    }: {
      owner: string;
      bounty_id: u32;
      new_title: Option<string>;
      new_distribution: Array<readonly [u32, u32]>;
      new_submission_deadline: Option<u64>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_hackathons transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hackathons: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_submission transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_submission: (
    { bounty_id, user }: { bounty_id: u32; user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a select_winners transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  select_winners: (
    {
      owner,
      bounty_id,
      winners,
    }: { owner: string; bounty_id: u32; winners: Array<string> },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a apply_to_bounty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  apply_to_bounty: (
    {
      applicant,
      bounty_id,
      submission_link,
    }: { applicant: string; bounty_id: u32; submission_link: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a cancel_hackathon transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_hackathon: (
    { admin, hackathon_id }: { admin: string; hackathon_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a create_hackathon transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_hackathon: (
    {
      admin,
      token,
      total_budget,
      prize_pool,
      deadline,
    }: {
      admin: string;
      token: string;
      total_budget: i128;
      prize_pool: Array<HackathonPrize>;
      deadline: u64;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a update_hackathon transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_hackathon: (
    {
      admin,
      hackathon_id,
      new_deadline,
      new_prize_pool,
    }: {
      admin: string;
      hackathon_id: u32;
      new_deadline: Option<u64>;
      new_prize_pool: Option<Array<HackathonPrize>>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_bounty_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty_status: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Status>>>;

  /**
   * Construct and simulate a get_user_bounties transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_bounties: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a update_submission transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_submission: (
    {
      applicant,
      bounty_id,
      new_submission_link,
    }: { applicant: string; bounty_id: u32; new_submission_link: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a cancel_project_gig transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_project_gig: (
    { owner, project_id }: { owner: string; project_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a create_project_gig transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_project_gig: (
    {
      owner,
      token,
      total_reward,
      milestones,
      deadline,
    }: {
      owner: string;
      token: string;
      total_reward: i128;
      milestones: Array<MilestoneData>;
      deadline: u64;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a create_project_job transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_project_job: (
    {
      owner,
      token,
      reward_amount,
      deadline,
    }: { owner: string; token: string; reward_amount: i128; deadline: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a get_bounties_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties_count: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_bounty_winners transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty_winners: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Array<string>>>>;

  /**
   * Construct and simulate a get_owner_bounties transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_owner_bounties: (
    { owner }: { owner: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_owner_projects transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_owner_projects: (
    { owner }: { owner: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a update_fee_account transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_fee_account: (
    { new_fee_account }: { new_fee_account: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a update_project_gig transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_project_gig: (
    {
      owner,
      project_id,
      new_milestones,
      new_deadline,
    }: {
      owner: string;
      project_id: u32;
      new_milestones: Option<Array<MilestoneData>>;
      new_deadline: Option<u64>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a update_project_job transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_project_job: (
    {
      owner,
      project_id,
      new_deadline,
    }: { owner: string; project_id: u32; new_deadline: Option<u64> },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_active_bounties transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_active_bounties: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_hackathons_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hackathons_count: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_hackathon_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hackathon_status: (
    { hackathon_id }: { hackathon_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<HackathonStatus>>>;

  /**
   * Construct and simulate a get_bounties_by_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties_by_token: (
    { token }: { token: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_bounty_applicants transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty_applicants: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Array<string>>>>;

  /**
   * Construct and simulate a get_bounties_by_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties_by_status: (
    { status }: { status: Status },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_bounty_submissions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounty_submissions: (
    { bounty_id }: { bounty_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Map<string, string>>>>;

  /**
   * Construct and simulate a get_projects_by_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_projects_by_status: (
    { status }: { status: ProjectStatus },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_user_bounties_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_bounties_count: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_hackathons_by_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hackathons_by_status: (
    { status }: { status: HackathonStatus },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_owner_bounties_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_owner_bounties_count: (
    { owner }: { owner: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a release_milestone_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_milestone_payment: (
    {
      owner,
      project_id,
      milestone_order,
      contributor,
      amount,
    }: {
      owner: string;
      project_id: u32;
      milestone_order: u32;
      contributor: string;
      amount: i128;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a distribute_hackathon_prizes transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  distribute_hackathon_prizes: (
    {
      admin,
      hackathon_id,
      winners,
    }: {
      admin: string;
      hackathon_id: u32;
      winners: Array<readonly [u32, string]>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_bounties_by_token_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties_by_token_count: (
    { token }: { token: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_bounties_by_status_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bounties_by_status_count: (
    { status }: { status: Status },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, fee_account }: { admin: string; fee_account: string },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, 'contractId'> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: 'hex' | 'base64';
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin, fee_account }, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        'AAAAAAAAAAAAAAAKZ2V0X2JvdW50eQAAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAEAAAPpAAAH0AAAAAZCb3VudHkAAAAAAAM=',
        'AAAAAAAAAAAAAAALZ2V0X3Byb2plY3QAAAAAAQAAAAAAAAAKcHJvamVjdF9pZAAAAAAABAAAAAEAAAPpAAAH0AAAAAdQcm9qZWN0AAAAAAM=',
        'AAAAAAAAAAAAAAAMY2xvc2VfYm91bnR5AAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAlib3VudHlfaWQAAAAAAAAEAAAAAQAAA+kAAAPtAAAAAAAAAAM=',
        'AAAAAAAAAAAAAAAMZ2V0X2JvdW50aWVzAAAAAAAAAAEAAAPqAAAABA==',
        'AAAAAAAAAAAAAAAMZ2V0X3Byb2plY3RzAAAAAAAAAAEAAAPqAAAABA==',
        'AAAAAAAAAAAAAAAMdXBkYXRlX2FkbWluAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAANY2hlY2tfanVkZ2luZwAAAAAAAAEAAAAAAAAACWJvdW50eV9pZAAAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAAAw==',
        'AAAAAAAAAAAAAAANY3JlYXRlX2JvdW50eQAAAAAAAAcAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZyZXdhcmQAAAAAAAsAAAAAAAAADGRpc3RyaWJ1dGlvbgAAA+oAAAPtAAAAAgAAAAQAAAAEAAAAAAAAABNzdWJtaXNzaW9uX2RlYWRsaW5lAAAAAAYAAAAAAAAAEGp1ZGdpbmdfZGVhZGxpbmUAAAAGAAAAAAAAAAV0aXRsZQAAAAAAABAAAAABAAAD6QAAAAQAAAAD',
        'AAAAAAAAAAAAAAANZGVsZXRlX2JvdW50eQAAAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAANZ2V0X2hhY2thdGhvbgAAAAAAAAEAAAAAAAAADGhhY2thdGhvbl9pZAAAAAQAAAABAAAD6QAAB9AAAAAJSGFja2F0aG9uAAAAAAAAAw==',
        'AAAAAAAAAAAAAAANdXBkYXRlX2JvdW50eQAAAAAAAAUAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAAAAAAJbmV3X3RpdGxlAAAAAAAD6AAAABAAAAAAAAAAEG5ld19kaXN0cmlidXRpb24AAAPqAAAD7QAAAAIAAAAEAAAABAAAAAAAAAAXbmV3X3N1Ym1pc3Npb25fZGVhZGxpbmUAAAAD6AAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==',
        'AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAALZmVlX2FjY291bnQAAAAAEwAAAAA=',
        'AAAAAAAAAAAAAAAOZ2V0X2hhY2thdGhvbnMAAAAAAAAAAAABAAAD6gAAAAQ=',
        'AAAAAAAAAAAAAAAOZ2V0X3N1Ym1pc3Npb24AAAAAAAIAAAAAAAAACWJvdW50eV9pZAAAAAAAAAQAAAAAAAAABHVzZXIAAAATAAAAAQAAA+kAAAAQAAAAAw==',
        'AAAAAAAAAAAAAAAOc2VsZWN0X3dpbm5lcnMAAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAAAAAAHd2lubmVycwAAAAPqAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAAPYXBwbHlfdG9fYm91bnR5AAAAAAMAAAAAAAAACWFwcGxpY2FudAAAAAAAABMAAAAAAAAACWJvdW50eV9pZAAAAAAAAAQAAAAAAAAAD3N1Ym1pc3Npb25fbGluawAAAAAQAAAAAQAAA+kAAAPtAAAAAAAAAAM=',
        'AAAAAAAAAAAAAAAQY2FuY2VsX2hhY2thdGhvbgAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMaGFja2F0aG9uX2lkAAAABAAAAAEAAAPpAAAACwAAAAM=',
        'AAAAAAAAAAAAAAAQY3JlYXRlX2hhY2thdGhvbgAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAx0b3RhbF9idWRnZXQAAAALAAAAAAAAAApwcml6ZV9wb29sAAAAAAPqAAAH0AAAAA5IYWNrYXRob25Qcml6ZQAAAAAAAAAAAAhkZWFkbGluZQAAAAYAAAABAAAD6QAAAAQAAAAD',
        'AAAAAAAAAAAAAAAQdXBkYXRlX2hhY2thdGhvbgAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMaGFja2F0aG9uX2lkAAAABAAAAAAAAAAMbmV3X2RlYWRsaW5lAAAD6AAAAAYAAAAAAAAADm5ld19wcml6ZV9wb29sAAAAAAPoAAAD6gAAB9AAAAAOSGFja2F0aG9uUHJpemUAAAAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAARZ2V0X2JvdW50eV9zdGF0dXMAAAAAAAABAAAAAAAAAAlib3VudHlfaWQAAAAAAAAEAAAAAQAAA+kAAAfQAAAABlN0YXR1cwAAAAAAAw==',
        'AAAAAAAAAAAAAAARZ2V0X3VzZXJfYm91bnRpZXMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==',
        'AAAAAAAAAAAAAAARdXBkYXRlX3N1Ym1pc3Npb24AAAAAAAADAAAAAAAAAAlhcHBsaWNhbnQAAAAAAAATAAAAAAAAAAlib3VudHlfaWQAAAAAAAAEAAAAAAAAABNuZXdfc3VibWlzc2lvbl9saW5rAAAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==',
        'AAAAAAAAAAAAAAASY2FuY2VsX3Byb2plY3RfZ2lnAAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACnByb2plY3RfaWQAAAAAAAQAAAABAAAD6QAAAAsAAAAD',
        'AAAAAAAAAAAAAAASY3JlYXRlX3Byb2plY3RfZ2lnAAAAAAAFAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAMdG90YWxfcmV3YXJkAAAACwAAAAAAAAAKbWlsZXN0b25lcwAAAAAD6gAAB9AAAAANTWlsZXN0b25lRGF0YQAAAAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAQAAA+kAAAAEAAAAAw==',
        'AAAAAAAAAAAAAAASY3JlYXRlX3Byb2plY3Rfam9iAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAANcmV3YXJkX2Ftb3VudAAAAAAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAABAAAAAM=',
        'AAAAAAAAAAAAAAASZ2V0X2JvdW50aWVzX2NvdW50AAAAAAAAAAAAAQAAAAQ=',
        'AAAAAAAAAAAAAAASZ2V0X2JvdW50eV93aW5uZXJzAAAAAAABAAAAAAAAAAlib3VudHlfaWQAAAAAAAAEAAAAAQAAA+kAAAPqAAAAEwAAAAM=',
        'AAAAAAAAAAAAAAASZ2V0X293bmVyX2JvdW50aWVzAAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6gAAAAQ=',
        'AAAAAAAAAAAAAAASZ2V0X293bmVyX3Byb2plY3RzAAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6gAAAAQ=',
        'AAAAAAAAAAAAAAASdXBkYXRlX2ZlZV9hY2NvdW50AAAAAAABAAAAAAAAAA9uZXdfZmVlX2FjY291bnQAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAASdXBkYXRlX3Byb2plY3RfZ2lnAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACnByb2plY3RfaWQAAAAAAAQAAAAAAAAADm5ld19taWxlc3RvbmVzAAAAAAPoAAAD6gAAB9AAAAANTWlsZXN0b25lRGF0YQAAAAAAAAAAAAAMbmV3X2RlYWRsaW5lAAAD6AAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==',
        'AAAAAAAAAAAAAAASdXBkYXRlX3Byb2plY3Rfam9iAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACnByb2plY3RfaWQAAAAAAAQAAAAAAAAADG5ld19kZWFkbGluZQAAA+gAAAAGAAAAAQAAA+kAAAPtAAAAAAAAAAM=',
        'AAAAAAAAAAAAAAATZ2V0X2FjdGl2ZV9ib3VudGllcwAAAAAAAAAAAQAAA+oAAAAE',
        'AAAAAAAAAAAAAAAUZ2V0X2hhY2thdGhvbnNfY291bnQAAAAAAAAAAQAAAAQ=',
        'AAAAAAAAAAAAAAAUZ2V0X2hhY2thdGhvbl9zdGF0dXMAAAABAAAAAAAAAAxoYWNrYXRob25faWQAAAAEAAAAAQAAA+kAAAfQAAAAD0hhY2thdGhvblN0YXR1cwAAAAAD',
        'AAAAAAAAAAAAAAAVZ2V0X2JvdW50aWVzX2J5X3Rva2VuAAAAAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAA+oAAAAE',
        'AAAAAAAAAAAAAAAVZ2V0X2JvdW50eV9hcHBsaWNhbnRzAAAAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAEAAAPpAAAD6gAAABMAAAAD',
        'AAAAAAAAAAAAAAAWZ2V0X2JvdW50aWVzX2J5X3N0YXR1cwAAAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAQAAA+oAAAAE',
        'AAAAAAAAAAAAAAAWZ2V0X2JvdW50eV9zdWJtaXNzaW9ucwAAAAAAAQAAAAAAAAAJYm91bnR5X2lkAAAAAAAABAAAAAEAAAPpAAAD7AAAABMAAAAQAAAAAw==',
        'AAAAAAAAAAAAAAAWZ2V0X3Byb2plY3RzX2J5X3N0YXR1cwAAAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVByb2plY3RTdGF0dXMAAAAAAAABAAAD6gAAAAQ=',
        'AAAAAAAAAAAAAAAXZ2V0X3VzZXJfYm91bnRpZXNfY291bnQAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAABA==',
        'AAAAAAAAAAAAAAAYZ2V0X2hhY2thdGhvbnNfYnlfc3RhdHVzAAAAAQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAD0hhY2thdGhvblN0YXR1cwAAAAABAAAD6gAAAAQ=',
        'AAAAAAAAAAAAAAAYZ2V0X293bmVyX2JvdW50aWVzX2NvdW50AAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAQ=',
        'AAAAAAAAAAAAAAAZcmVsZWFzZV9taWxlc3RvbmVfcGF5bWVudAAAAAAAAAUAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAKcHJvamVjdF9pZAAAAAAABAAAAAAAAAAPbWlsZXN0b25lX29yZGVyAAAAAAQAAAAAAAAAC2NvbnRyaWJ1dG9yAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAAbZGlzdHJpYnV0ZV9oYWNrYXRob25fcHJpemVzAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMaGFja2F0aG9uX2lkAAAABAAAAAAAAAAHd2lubmVycwAAAAPqAAAD7QAAAAIAAAAEAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAAAAAAAAAAAAAbZ2V0X2JvdW50aWVzX2J5X3Rva2VuX2NvdW50AAAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAE',
        'AAAAAAAAAAAAAAAcZ2V0X2JvdW50aWVzX2J5X3N0YXR1c19jb3VudAAAAAEAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAAEAAAAE',
        'AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAIwAAAAAAAAAITm90QWRtaW4AAAABAAAAAAAAABFBZG1pbkNhbm5vdEJlWmVybwAAAAAAAAIAAAAAAAAAFkZlZUFjY291bnRDYW5ub3RCZVplcm8AAAAAAAMAAAAAAAAADlNhbWVGZWVBY2NvdW50AAAAAAAEAAAAAAAAAAlPbmx5T3duZXIAAAAAAAAFAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAGAAAAAAAAAA5Cb3VudHlOb3RGb3VuZAAAAAAABwAAAAAAAAAOSW5hY3RpdmVCb3VudHkAAAAAAAgAAAAAAAAAFEJvdW50eURlYWRsaW5lUGFzc2VkAAAACQAAAAAAAAAVSnVkZ2luZ0RlYWRsaW5lUGFzc2VkAAAAAAAACgAAAAAAAAAUQm91bnR5SGFzU3VibWlzc2lvbnMAAAALAAAAAAAAACtDYW5ub3RTZWxlY3RXaW5uZXJzQmVmb3JlU3VibWlzc2lvbkRlYWRsaW5lAAAAAAwAAAAAAAAALEp1ZGdpbmdEZWFkbGluZU11c3RCZUFmdGVyU3VibWlzc2lvbkRlYWRsaW5lAAAADQAAAAAAAAAQTm90RW5vdWdoV2lubmVycwAAAA4AAAAAAAAAGERpc3RyaWJ1dGlvbk11c3RTdW1UbzEwMAAAAA8AAAAAAAAAFUludmFsaWREZWFkbGluZVVwZGF0ZQAAAAAAABAAAAAAAAAAElN1Ym1pc3Npb25Ob3RGb3VuZAAAAAAAEQAAAAAAAAAPUHJvamVjdE5vdEZvdW5kAAAAABIAAAAAAAAAEkludmFsaWRQcm9qZWN0VHlwZQAAAAAAEwAAAAAAAAAQUHJvamVjdE5vdEFjdGl2ZQAAABQAAAAAAAAAEUludmFsaWRNaWxlc3RvbmVzAAAAAAAAFQAAAAAAAAARTWlsZXN0b25lTm90Rm91bmQAAAAAAAAWAAAAAAAAABRNaWxlc3RvbmVBbHJlYWR5UGFpZAAAABcAAAAAAAAAEkluc3VmZmljaWVudEVzY3JvdwAAAAAAGAAAAAAAAAANSW52YWxpZFJld2FyZAAAAAAAABkAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAaAAAAAAAAAA5EZWFkbGluZVBhc3NlZAAAAAAAGwAAAAAAAAANSW50ZXJuYWxFcnJvcgAAAAAAABwAAAAAAAAAEUhhY2thdGhvbk5vdEZvdW5kAAAAAAAAHQAAAAAAAAASSGFja2F0aG9uTm90QWN0aXZlAAAAAAAeAAAAAAAAABdIYWNrYXRob25EZWFkbGluZVBhc3NlZAAAAAAfAAAAAAAAABBJbnZhbGlkUHJpemVQb29sAAAAIAAAAAAAAAAVSGFja2F0aG9uTm90Q29tcGxldGVkAAAAAAAAIQAAAAAAAAAPSW52YWxpZFBvc2l0aW9uAAAAACIAAAAAAAAAFUFsbFBvc2l0aW9uc05vdEZpbGxlZAAAAAAAACM=',
        'AAAAAQAAAAAAAAAAAAAABkJvdW50eQAAAAAACwAAAAAAAAAKYXBwbGljYW50cwAAAAAD6gAAABMAAAAAAAAADGRpc3RyaWJ1dGlvbgAAA+wAAAAEAAAABAAAAAAAAAAQanVkZ2luZ19kZWFkbGluZQAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGcmV3YXJkAAAAAAALAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAGU3RhdHVzAAAAAAAAAAAAE3N1Ym1pc3Npb25fZGVhZGxpbmUAAAAABgAAAAAAAAALc3VibWlzc2lvbnMAAAAD7AAAABMAAAAQAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAHd2lubmVycwAAAAPqAAAAEw==',
        'AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABkFjdGl2ZQAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAGQ2xvc2VkAAA=',
        'AAAAAQAAAAAAAAAAAAAAB1Byb2plY3QAAAAACAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAptaWxlc3RvbmVzAAAAAAPqAAAH0AAAAA1NaWxlc3RvbmVJbmZvAAAAAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHByb2plY3RfdHlwZQAAB9AAAAALUHJvamVjdFR5cGUAAAAAAAAAABByZW1haW5pbmdfZXNjcm93AAAACwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVByb2plY3RTdGF0dXMAAAAAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAMdG90YWxfcmV3YXJkAAAACw==',
        'AAAAAQAAAAAAAAAAAAAACUhhY2thdGhvbgAAAAAAAAgAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAApwcml6ZV9wb29sAAAAAAPqAAAH0AAAAA5IYWNrYXRob25Qcml6ZQAAAAAAAAAAABByZW1haW5pbmdfZXNjcm93AAAACwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAD0hhY2thdGhvblN0YXR1cwAAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAMdG90YWxfYnVkZ2V0AAAACwAAAAAAAAAHd2lubmVycwAAAAPsAAAABAAAABM=',
        'AAAAAgAAAAAAAAAAAAAAC1Byb2plY3RUeXBlAAAAAAIAAAAAAAAAAAAAAANHaWcAAAAAAAAAAAAAAAADSm9iAA==',
        'AAAAAQAAAAAAAAAAAAAADU1pbGVzdG9uZURhdGEAAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABW9yZGVyAAAAAAAABA==',
        'AAAAAQAAAAAAAAAAAAAADU1pbGVzdG9uZUluZm8AAAAAAAADAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAB2lzX3BhaWQAAAAAAQAAAAAAAAAFb3JkZXIAAAAAAAAE',
        'AAAAAgAAAAAAAAAAAAAADVByb2plY3RTdGF0dXMAAAAAAAADAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAAAAAAAAAAAAAlDYW5jZWxsZWQAAAA=',
        'AAAAAQAAAAAAAAAAAAAADkhhY2thdGhvblByaXplAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACHBvc2l0aW9uAAAABA==',
        'AAAAAgAAAAAAAAAAAAAAD0hhY2thdGhvblN0YXR1cwAAAAADAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAAAAAAAAAAAAAlDYW5jZWxsZWQAAAA=',
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    get_bounty: this.txFromJSON<Result<Bounty>>,
    get_project: this.txFromJSON<Result<Project>>,
    close_bounty: this.txFromJSON<Result<void>>,
    get_bounties: this.txFromJSON<Array<u32>>,
    get_projects: this.txFromJSON<Array<u32>>,
    update_admin: this.txFromJSON<Result<void>>,
    check_judging: this.txFromJSON<Result<void>>,
    create_bounty: this.txFromJSON<Result<u32>>,
    delete_bounty: this.txFromJSON<Result<void>>,
    get_hackathon: this.txFromJSON<Result<Hackathon>>,
    update_bounty: this.txFromJSON<Result<void>>,
    get_hackathons: this.txFromJSON<Array<u32>>,
    get_submission: this.txFromJSON<Result<string>>,
    select_winners: this.txFromJSON<Result<void>>,
    apply_to_bounty: this.txFromJSON<Result<void>>,
    cancel_hackathon: this.txFromJSON<Result<i128>>,
    create_hackathon: this.txFromJSON<Result<u32>>,
    update_hackathon: this.txFromJSON<Result<void>>,
    get_bounty_status: this.txFromJSON<Result<Status>>,
    get_user_bounties: this.txFromJSON<Array<u32>>,
    update_submission: this.txFromJSON<Result<void>>,
    cancel_project_gig: this.txFromJSON<Result<i128>>,
    create_project_gig: this.txFromJSON<Result<u32>>,
    create_project_job: this.txFromJSON<Result<u32>>,
    get_bounties_count: this.txFromJSON<u32>,
    get_bounty_winners: this.txFromJSON<Result<Array<string>>>,
    get_owner_bounties: this.txFromJSON<Array<u32>>,
    get_owner_projects: this.txFromJSON<Array<u32>>,
    update_fee_account: this.txFromJSON<Result<void>>,
    update_project_gig: this.txFromJSON<Result<void>>,
    update_project_job: this.txFromJSON<Result<void>>,
    get_active_bounties: this.txFromJSON<Array<u32>>,
    get_hackathons_count: this.txFromJSON<u32>,
    get_hackathon_status: this.txFromJSON<Result<HackathonStatus>>,
    get_bounties_by_token: this.txFromJSON<Array<u32>>,
    get_bounty_applicants: this.txFromJSON<Result<Array<string>>>,
    get_bounties_by_status: this.txFromJSON<Array<u32>>,
    get_bounty_submissions: this.txFromJSON<Result<Map<string, string>>>,
    get_projects_by_status: this.txFromJSON<Array<u32>>,
    get_user_bounties_count: this.txFromJSON<u32>,
    get_hackathons_by_status: this.txFromJSON<Array<u32>>,
    get_owner_bounties_count: this.txFromJSON<u32>,
    release_milestone_payment: this.txFromJSON<Result<void>>,
    distribute_hackathon_prizes: this.txFromJSON<Result<void>>,
    get_bounties_by_token_count: this.txFromJSON<u32>,
    get_bounties_by_status_count: this.txFromJSON<u32>,
  };
}
