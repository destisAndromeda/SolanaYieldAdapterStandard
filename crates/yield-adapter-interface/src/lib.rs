use anchor_lang::prelude::*;

pub const EXTRA_DATA_MAX_LEN: usize = 64;

pub const ADAPTER_DEPOSIT_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_deposit")[..8]
    [190, 207, 72, 186, 232, 106, 46, 72]
};

pub const ADAPTER_WITHDRAW_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_withdraw")[..8]
    [121, 55, 72, 46, 185, 100, 173, 236]
};

pub const ADAPTER_CURRENT_VALUE_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_current_value")[..8]
    [67, 200, 59, 238, 163, 138, 170, 179]
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AdapterStatus {
    Active,
    Paused,
    Deprecated,
}

impl AdapterStatus {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Active),
            1 => Some(Self::Paused),
            2 => Some(Self::Deprecated),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        match self {
            Self::Active => 0,
            Self::Paused => 1,
            Self::Deprecated => 2,
        }
    }

    pub fn is_active(self) -> bool {
        matches!(self, Self::Active)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolId {
    KaminoUsdc,
    MarginFiUsdc,
    JupiterLp,
    MapleSyrup,
    DriftInsuranceFund,
}

impl ProtocolId {
    pub fn from_u16(value: u16) -> Option<Self> {
        match value {
            0 => Some(Self::KaminoUsdc),
            1 => Some(Self::MarginFiUsdc),
            2 => Some(Self::JupiterLp),
            3 => Some(Self::MapleSyrup),
            4 => Some(Self::DriftInsuranceFund),
            _ => None,
        }
    }

    pub fn as_u16(self) -> u16 {
        match self {
            Self::KaminoUsdc => 0,
            Self::MarginFiUsdc => 1,
            Self::JupiterLp => 2,
            Self::MapleSyrup => 3,
            Self::DriftInsuranceFund => 4,
        }
    }
}

pub fn set_return_u64(value: u64) {
    anchor_lang::solana_program::program::set_return_data(&value.to_le_bytes());
}

pub fn read_return_u64() -> Result<u64> {
    let data = anchor_lang::solana_program::program::get_return_data()
        .map(|(_, data)| data)
        .ok_or(error!(YieldAdapterInterfaceError::MissingReturnData))?;

    require!(
        data.len() >= 8,
        YieldAdapterInterfaceError::InvalidReturnData,
    );

    let mut value = [0u8; 8];
    value.copy_from_slice(&data[..8]);
    Ok(u64::from_le_bytes(value))
}

#[error_code]
pub enum YieldAdapterInterfaceError {
    #[msg("Missing return data")]
    MissingReturnData,

    #[msg("Invalid return data")]
    InvalidReturnData,
}
