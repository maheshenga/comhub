import { BRANDING_NAME } from '@lobechat/business-const';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_RUNTIME_BRAND } from '@/const/brand';
import { DEFAULT_USER_AVATAR_URL } from '@/const/meta';
import { useUserStore } from '@/store/user';

import UserAvatar from '../UserAvatar';

// `useBrandName()` resolves the runtime default brand first and only falls back
// to the build-time `BRANDING_NAME`.
const defaultBrandName = DEFAULT_RUNTIME_BRAND.name || BRANDING_NAME;

describe('UserAvatar', () => {
  it('should show the username and avatar are displayed when the user is logged in', async () => {
    const mockAvatar = 'https://example.com/avatar.png';
    const mockUsername = 'teeeeeestuser';

    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        user: { avatar: mockAvatar, id: 'abc', username: mockUsername },
      });
    });

    render(<UserAvatar />);

    expect(screen.getByAltText(mockUsername)).toBeInTheDocument();
    expect(screen.getByAltText(mockUsername)).toHaveAttribute('src', mockAvatar);
  });

  it('should show default avatar when the user is logged in but have no custom avatar', () => {
    const mockUsername = 'testuser';

    act(() => {
      useUserStore.setState({
        isSignedIn: true,
        user: { id: 'bbb', username: mockUsername },
      });
    });

    render(<UserAvatar />);
    // When user has no avatar url, <Avatar /> falls back to initials rendering (not an <img />)
    expect(screen.getByText('TE')).toBeInTheDocument();
  });

  it('should show the default brand and default avatar when the user is not logged in', () => {
    act(() => {
      useUserStore.setState({ isSignedIn: false, user: undefined });
    });

    render(<UserAvatar />);
    expect(screen.getByAltText(defaultBrandName)).toBeInTheDocument();
    expect(screen.getByAltText(defaultBrandName)).toHaveAttribute('src', DEFAULT_USER_AVATAR_URL);
  });
});
