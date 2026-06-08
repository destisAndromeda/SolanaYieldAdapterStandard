use anchor_lang::prelude::*;

pub fn read_bytes(data: &[u8], offset: usize, length: usize) -> Result<&[u8]> {
    let end = offset
        .checked_add(length)
        .ok_or(error!(crate::YieldAdapterInterfaceError::OffsetOverflow))?;

    require!(data.len() >= end, crate::YieldAdapterInterfaceError::AccountDataTooShort);

    Ok(&data[offset..end])
}

pub fn read_u64_le(data: &[u8], offset: usize) -> Result<u64> {
    let bytes = read_bytes(data, offset, 8)?;
    let mut value = [0u8; 8];
    value.copy_from_slice(bytes);
    Ok(u64::from_le_bytes(value))
}

pub fn read_u128_le(data: &[u8], offset: usize) -> Result<u128> {
    let bytes = read_bytes(data, offset, 16)?;
    let mut value = [0u8; 16];
    value.copy_from_slice(bytes);
    Ok(u128::from_le_bytes(value))
}

pub fn read_i128_le(data: &[u8], offset: usize) -> Result<i128> {
    let bytes = read_bytes(data, offset, 16)?;
    let mut value = [0u8; 16];
    value.copy_from_slice(bytes);
    Ok(i128::from_le_bytes(value))
}

pub fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    let bytes = read_bytes(data, offset, 32)?;
    let array: [u8; 32] = bytes
        .try_into()
        .map_err(|_| error!(crate::YieldAdapterInterfaceError::InvalidAccountData))?;
    Ok(Pubkey::new_from_array(array))
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::Pubkey;

    #[test]
    fn read_bytes_bounds_check() {
        let data = [1u8, 2, 3, 4];
        assert!(read_bytes(&data, 2, 3).is_err());
        assert!(read_bytes(&data, usize::MAX, 1).is_err());
    }

    #[test]
    fn read_u64_le_success() {
        let data = [1u8, 0, 0, 0, 0, 0, 0, 0, 9];
        assert_eq!(read_u64_le(&data, 0).unwrap(), 1);
        assert_eq!(read_u64_le(&data, 1).unwrap(), 72057594037927936);
    }

    #[test]
    fn read_u128_le_success() {
        let mut data = [0u8; 24];
        data[8..24].copy_from_slice(&42u128.to_le_bytes());
        assert_eq!(read_u128_le(&data, 8).unwrap(), 42);
    }

    #[test]
    fn read_i128_le_success() {
        let mut data = [0u8; 24];
        data[8..24].copy_from_slice(&(-42i128).to_le_bytes());
        assert_eq!(read_i128_le(&data, 8).unwrap(), -42);
    }

    #[test]
    fn read_pubkey_success() {
        let pubkey = Pubkey::new_unique();
        let mut data = [0u8; 40];
        data[8..40].copy_from_slice(pubkey.as_ref());
        assert_eq!(read_pubkey(&data, 8).unwrap(), pubkey);
    }
}
