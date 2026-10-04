namespace Dubhe.Domain.Common;

public static class ErrorCodes
{
    public const string ValidationError = "validation_error";
    public const string NotFound = "not_found";
    public const string Forbidden = "forbidden";
    public const string Conflict = "conflict";
    public const string InternalError = "internal_error";

    public const string InvalidCredentials = "invalid_credentials";
    public const string UserExists = "user_exists";
    public const string AccountLocked = "account_locked";
    public const string AccountFrozen = "account_frozen";
    public const string AccountPendingReview = "account_pending_review";
    public const string AccountRejected = "account_rejected";

    public const string TokenInvalid = "token_invalid";
    public const string TokenExpired = "token_expired";
    public const string RefreshTokenInvalid = "refresh_token_invalid";

    public const string OrderStateInvalid = "order_state_invalid";
    public const string OutOfServiceArea = "out_of_service_area";
    public const string ProhibitedItem = "prohibited_item";
    public const string DroneUnavailable = "drone_unavailable";
    public const string ResourceConflict = "resource_conflict";
    public const string AirspaceConflict = "airspace_conflict";
}
