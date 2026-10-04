using System.Diagnostics;
using System.Text.Json;
using Dubhe.Application.Config.Dtos;

namespace Dubhe.Infrastructure.Http;

public sealed class EndpointTester : IEndpointTester
{
    private readonly IHttpClientFactory _httpClientFactory;

    public EndpointTester(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<EndpointCallResult> TestAsync(
        string method,
        string url,
        int timeoutSeconds,
        string? headersJson,
        CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 1, 60));

            using var request = new HttpRequestMessage(new HttpMethod(method.ToUpperInvariant()), url);
            ApplyHeaders(request, headersJson);

            using var response = await client.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            stopwatch.Stop();

            var snippet = body.Length > 500 ? body[..500] : body;
            return new EndpointCallResult(
                response.IsSuccessStatusCode,
                (int)response.StatusCode,
                (int)stopwatch.ElapsedMilliseconds,
                snippet,
                response.IsSuccessStatusCode ? null : $"HTTP {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new EndpointCallResult(false, null, (int)stopwatch.ElapsedMilliseconds, null, ex.Message);
        }
    }

    private static void ApplyHeaders(HttpRequestMessage request, string? headersJson)
    {
        if (string.IsNullOrWhiteSpace(headersJson))
        {
            return;
        }

        try
        {
            var headers = JsonSerializer.Deserialize<Dictionary<string, string>>(headersJson);
            if (headers is null)
            {
                return;
            }

            foreach (var (key, value) in headers)
            {
                request.Headers.TryAddWithoutValidation(key, value);
            }
        }
        catch
        {
            // 非法 header 配置忽略，测试结果会体现为请求失败
        }
    }
}
