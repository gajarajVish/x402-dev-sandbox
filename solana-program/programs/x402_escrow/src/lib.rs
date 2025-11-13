use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE");

#[program]
pub mod x402_escrow {
    use super::*;

    /// Initialize a new payment requirement
    /// This is called by the seller to create payment requirements for an API request
    pub fn initialize_payment(
        ctx: Context<InitializePayment>,
        request_id: String,
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(expires_at > Clock::get()?.unix_timestamp, ErrorCode::InvalidExpiration);
        require!(request_id.len() <= 64, ErrorCode::RequestIdTooLong);

        let payment = &mut ctx.accounts.payment_requirement;
        payment.seller = ctx.accounts.seller.key();
        payment.request_id = request_id;
        payment.amount = amount;
        payment.expires_at = expires_at;
        payment.is_paid = false;
        payment.payer = Pubkey::default();
        payment.bump = ctx.bumps.payment_requirement;

        msg!("Payment requirement initialized: {} lamports", amount);
        Ok(())
    }

    /// Deposit payment from buyer to escrow
    /// This is called by the buyer to pay for the API request
    pub fn deposit_payment(
        ctx: Context<DepositPayment>,
        request_id: String,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment_requirement;

        // Validate payment hasn't been made yet
        require!(!payment.is_paid, ErrorCode::AlreadyPaid);

        // Validate not expired
        require!(
            Clock::get()?.unix_timestamp < payment.expires_at,
            ErrorCode::PaymentExpired
        );

        // Validate request ID matches
        require!(payment.request_id == request_id, ErrorCode::InvalidRequestId);

        // Transfer SOL from payer to payment account (escrow)
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.payment_requirement.to_account_info(),
            },
        );
        transfer(cpi_context, payment.amount)?;

        // Mark as paid and record payer
        payment.is_paid = true;
        payment.payer = ctx.accounts.payer.key();

        msg!("Payment deposited: {} lamports from {}", payment.amount, payment.payer);
        Ok(())
    }

    /// Verify payment and release funds to seller
    /// This is called by the facilitator after verifying the payment
    pub fn verify_and_release(
        ctx: Context<VerifyAndRelease>,
        request_id: String,
    ) -> Result<()> {
        let payment = &ctx.accounts.payment_requirement;

        // Validate payment has been made
        require!(payment.is_paid, ErrorCode::NotPaid);

        // Validate request ID matches
        require!(payment.request_id == request_id, ErrorCode::InvalidRequestId);

        // Validate seller is correct
        require!(payment.seller == ctx.accounts.seller.key(), ErrorCode::UnauthorizedSeller);

        let amount = payment.amount;
        let seller_key = payment.seller;
        let bump = payment.bump;

        // Transfer SOL from payment account to seller
        let seeds = &[
            b"payment",
            seller_key.as_ref(),
            request_id.as_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payment_requirement.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_context, amount)?;

        msg!("Payment released: {} lamports to seller {}", amount, seller_key);
        Ok(())
    }

    /// Cancel and refund an expired or invalid payment
    /// This can be called by the payer to get a refund if something went wrong
    pub fn refund_payment(
        ctx: Context<RefundPayment>,
        request_id: String,
    ) -> Result<()> {
        let payment = &ctx.accounts.payment_requirement;

        // Validate payment has been made
        require!(payment.is_paid, ErrorCode::NotPaid);

        // Validate request ID matches
        require!(payment.request_id == request_id, ErrorCode::InvalidRequestId);

        // Validate caller is the payer
        require!(payment.payer == ctx.accounts.payer.key(), ErrorCode::UnauthorizedPayer);

        // Validate payment is expired
        require!(
            Clock::get()?.unix_timestamp >= payment.expires_at,
            ErrorCode::PaymentNotExpired
        );

        let amount = payment.amount;
        let payer_key = payment.payer;
        let seller_key = payment.seller;
        let bump = payment.bump;

        // Transfer SOL from payment account back to payer
        let seeds = &[
            b"payment",
            seller_key.as_ref(),
            request_id.as_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payment_requirement.to_account_info(),
                to: ctx.accounts.payer.to_account_info(),
            },
            signer_seeds,
        );
        transfer(cpi_context, amount)?;

        msg!("Payment refunded: {} lamports to payer {}", amount, payer_key);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(request_id: String)]
pub struct InitializePayment<'info> {
    #[account(
        init,
        payer = seller,
        space = 8 + PaymentRequirement::INIT_SPACE,
        seeds = [b"payment", seller.key().as_ref(), request_id.as_bytes()],
        bump
    )]
    pub payment_requirement: Account<'info, PaymentRequirement>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(request_id: String)]
pub struct DepositPayment<'info> {
    #[account(
        mut,
        seeds = [b"payment", payment_requirement.seller.as_ref(), request_id.as_bytes()],
        bump = payment_requirement.bump
    )]
    pub payment_requirement: Account<'info, PaymentRequirement>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(request_id: String)]
pub struct VerifyAndRelease<'info> {
    #[account(
        mut,
        seeds = [b"payment", seller.key().as_ref(), request_id.as_bytes()],
        bump = payment_requirement.bump,
        close = seller
    )]
    pub payment_requirement: Account<'info, PaymentRequirement>,

    #[account(mut)]
    pub seller: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(request_id: String)]
pub struct RefundPayment<'info> {
    #[account(
        mut,
        seeds = [b"payment", payment_requirement.seller.as_ref(), request_id.as_bytes()],
        bump = payment_requirement.bump,
        close = payer
    )]
    pub payment_requirement: Account<'info, PaymentRequirement>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentRequirement {
    pub seller: Pubkey,          // 32 bytes
    #[max_len(64)]
    pub request_id: String,      // 4 + 64 bytes
    pub amount: u64,             // 8 bytes
    pub expires_at: i64,         // 8 bytes
    pub is_paid: bool,           // 1 byte
    pub payer: Pubkey,           // 32 bytes
    pub bump: u8,                // 1 byte
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,

    #[msg("Invalid expiration: must be in the future")]
    InvalidExpiration,

    #[msg("Request ID too long: maximum 64 characters")]
    RequestIdTooLong,

    #[msg("Payment already made")]
    AlreadyPaid,

    #[msg("Payment expired")]
    PaymentExpired,

    #[msg("Invalid request ID")]
    InvalidRequestId,

    #[msg("Unauthorized seller")]
    UnauthorizedSeller,

    #[msg("Payment not made yet")]
    NotPaid,

    #[msg("Unauthorized payer")]
    UnauthorizedPayer,

    #[msg("Payment not expired yet")]
    PaymentNotExpired,
}
