using Dubhe.Domain.Auth;

namespace Dubhe.Application.Abstractions;

public interface IClientContext
{
    DeviceType DeviceType { get; }
    string? Ip { get; }
}
