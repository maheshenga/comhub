import { AUTH_REQUIRED_HEADER } from '@lobechat/desktop-bridge';
import {
  AgentRuntimeErrorType,
  type ILobeAgentRuntimeErrorType,
} from '@lobechat/model-runtime/types/error';
import { type ErrorResponse, type ErrorType } from '@lobechat/types';
import { ChatErrorType } from '@lobechat/types';

/**
 * Error types that indicate a real authentication failure.
 * When these errors occur, the response will include X-Auth-Required header
 * to signal the client that re-authentication is needed.
 */
const AUTH_REQUIRED_ERROR_TYPES = new Set<ErrorType>([ChatErrorType.Unauthorized]);

const INTERNAL_ERROR_MESSAGE = 'An internal error occurred';

const sanitizeErrorResponseValue = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown => {
  if (value instanceof Error) {
    return { message: INTERNAL_ERROR_MESSAGE, name: value.name };
  }

  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toJSON();
  if (seen.has(value)) return undefined;

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizeErrorResponseValue(item, seen));
    seen.delete(value);
    return sanitized;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'cause' || key === 'stack') continue;
    sanitized[key] = sanitizeErrorResponseValue(nestedValue, seen);
  }

  seen.delete(value);
  return sanitized;
};

const getStatus = (errorType: ILobeAgentRuntimeErrorType | ErrorType) => {
  // InvalidAccessCode / InvalidAzureAPIKey / InvalidOpenAIAPIKey / InvalidZhipuAPIKey ....
  if (errorType.toString().includes('Invalid')) return 401;

  switch (errorType) {
    case ChatErrorType.SubscriptionPlanLimit:
    case ChatErrorType.FreePlanLimit:
    case ChatErrorType.InsufficientBudgetForModel:
    case ChatErrorType.WorkspaceFrozenByAdmin:
    case ChatErrorType.WorkspaceFrozenByRiskControl:
    case ChatErrorType.WorkspaceSubscriptionInactive: {
      return 403;
    }

    // TODO: Need to refactor to Invalid OpenAI API Key
    case AgentRuntimeErrorType.InvalidProviderAPIKey:
    case AgentRuntimeErrorType.NoOpenAIAPIKey: {
      return 401;
    }

    case AgentRuntimeErrorType.ExceededContextWindow:
    case AgentRuntimeErrorType.ExceededToolLimit:
    case ChatErrorType.SubscriptionKeyMismatch:
    case ChatErrorType.SystemTimeNotMatchError:
    case ChatErrorType.LobeHubModelDeprecated: {
      return 400;
    }

    case AgentRuntimeErrorType.LocationNotSupportError: {
      return 403;
    }

    case AgentRuntimeErrorType.ModelNotFound: {
      return 404;
    }

    case AgentRuntimeErrorType.AccountDeactivated: {
      return 403;
    }

    case AgentRuntimeErrorType.InsufficientQuota:
    case AgentRuntimeErrorType.QuotaLimitReached: {
      return 429;
    }

    // define the 471~480 as provider error
    case AgentRuntimeErrorType.AgentRuntimeError: {
      return 470;
    }

    case AgentRuntimeErrorType.ProviderBizError:
    case AgentRuntimeErrorType.ProviderContentPolicyViolation: {
      return 471;
    }

    // all local provider connection error
    case AgentRuntimeErrorType.OllamaServiceUnavailable:
    case ChatErrorType.OllamaServiceUnavailable:
    case AgentRuntimeErrorType.OllamaBizError: {
      return 472;
    }
  }

  return errorType as number;
};

export const createErrorResponse = (
  errorType: ErrorType | ILobeAgentRuntimeErrorType,
  body?: any,
) => {
  const statusCode = getStatus(errorType);

  const data: ErrorResponse = {
    body: sanitizeErrorResponseValue(body),
    errorType,
  };

  if (typeof statusCode !== 'number' || statusCode < 200 || statusCode > 599) {
    console.error(
      `current StatusCode: \`${statusCode}\` .`,
      'Please go to `./src/app/api/errorResponse.ts` to defined the statusCode.',
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add X-Auth-Required header for real authentication failures
  // This allows the client to distinguish between auth failures and other 401 errors (e.g., invalid API keys)
  if (AUTH_REQUIRED_ERROR_TYPES.has(errorType as ErrorType)) {
    headers[AUTH_REQUIRED_HEADER] = 'true';
  }

  // Normalize the already-sanitized payload to a primitive string before exposing it.
  const responseBody = JSON.stringify(data).toString();

  return new Response(responseBody, { headers, status: statusCode });
};
