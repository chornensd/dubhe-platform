namespace Dubhe.Domain.Common;

public sealed class AppException : Exception
{
    public string ErrorCode { get; }

    public AppException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode;
    }

    public static AppException Validation(string message) => new(ErrorCodes.ValidationError, message);

    public static AppException NotFound(string message) => new(ErrorCodes.NotFound, message);

    public static AppException Forbidden(string message) => new(ErrorCodes.Forbidden, message);

    public static AppException Conflict(string message) => new(ErrorCodes.Conflict, message);
}
